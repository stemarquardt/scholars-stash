import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Router, type Request, type Response } from "express";
import { db, usersTable, userIdentitiesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import {
  clearSession,
  createSession,
  getSessionId,
  getSession,
  updateSession,
  SESSION_COOKIE,
  SESSION_TTL,
  IS_SECURE,
  type SessionData,
} from "../lib/auth";

// ── Normalised profile shape ─────────────────────────────────────────────────

interface NormalisedProfile {
  providerUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
}

// ── Strategy registration (conditional — skip if env vars absent) ────────────

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "/api/callback/google",
      },
      (_at, _rt, profile, done) => {
        const firstName = profile.name?.givenName ?? null;
        const lastName = profile.name?.familyName ?? null;
        const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : null;
        const norm: NormalisedProfile = {
          providerUserId: profile.id,
          email: profile.emails?.[0]?.value ?? null,
          firstName,
          lastName,
          displayName: firstName
            ? lastInitial ? `${firstName} ${lastInitial}.` : firstName
            : (profile.displayName ?? null),
          profileImageUrl: profile.photos?.[0]?.value ?? null,
        };
        done(null, norm as any);
      },
    ),
  );
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    "facebook",
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL ?? "/api/callback/facebook",
        profileFields: ["id", "emails", "name", "picture.type(large)"],
      },
      (_at, _rt, profile, done) => {
        const firstName = (profile.name as any)?.givenName ?? null;
        const lastName = (profile.name as any)?.familyName ?? null;
        const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : null;
        const norm: NormalisedProfile = {
          providerUserId: profile.id,
          email: (profile.emails as any)?.[0]?.value ?? null,
          firstName,
          lastName,
          displayName: firstName
            ? lastInitial ? `${firstName} ${lastInitial}.` : firstName
            : (profile.displayName ?? null),
          profileImageUrl: (profile.photos as any)?.[0]?.value ?? null,
        };
        done(null, norm as any);
      },
    ),
  );
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  // passport-discord has no @types; use dynamic require to avoid TS complaints
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DiscordStrategy = require("passport-discord").Strategy;
  passport.use(
    "discord",
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL ?? "/api/callback/discord",
        scope: ["identify", "email"],
      },
      (_at: string, _rt: string, profile: any, done: (err: any, user?: any) => void) => {
        const avatarUrl = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null;
        const norm: NormalisedProfile = {
          providerUserId: profile.id,
          email: profile.email ?? null,
          firstName: profile.global_name ?? profile.username ?? null,
          lastName: null,
          displayName: profile.global_name ?? profile.username ?? null,
          profileImageUrl: avatarUrl,
        };
        done(null, norm as any);
      },
    ),
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = ["google", "facebook", "discord"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(p: string): p is Provider {
  return (VALID_PROVIDERS as readonly string[]).includes(p);
}

function isProviderConfigured(provider: Provider): boolean {
  switch (provider) {
    case "google":
      return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case "facebook":
      return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    case "discord":
      return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
  }
}

const PROVIDER_SCOPES: Record<Provider, string[]> = {
  google: ["profile", "email"],
  facebook: ["email"],
  discord: ["identify", "email"],
};

const router = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: IS_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

// Look up or create a user based on provider identity, then return the DB row.
async function upsertUserFromIdentity(provider: Provider, profile: NormalisedProfile) {
  // 1. Check if we already know this identity
  const [existing] = await db
    .select({ userId: userIdentitiesTable.userId })
    .from(userIdentitiesTable)
    .where(
      and(
        eq(userIdentitiesTable.provider, provider),
        eq(userIdentitiesTable.providerUserId, profile.providerUserId),
      ),
    )
    .limit(1);

  if (existing) {
    // Update the user's profile info (name/avatar may change)
    const [user] = await db
      .update(usersTable)
      .set({
        email: profile.email ?? undefined,
        firstName: profile.firstName ?? undefined,
        lastName: profile.lastName ?? undefined,
        displayName: profile.displayName ?? undefined,
        profileImageUrl: profile.profileImageUrl ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.userId))
      .returning();
    return user;
  }

  // 2. No identity yet — check if email matches an existing user (account merge)
  let userId: string | null = null;
  if (profile.email) {
    const [byEmail] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, profile.email))
      .limit(1);
    if (byEmail) userId = byEmail.id;
  }

  if (!userId) {
    // 3. Create a brand-new user (id defaults to gen_random_uuid())
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
        profileImageUrl: profile.profileImageUrl,
      })
      .returning();
    userId = newUser.id;
  }

  // 4. Create the identity record
  await db.insert(userIdentitiesTable).values({
    userId,
    provider,
    providerUserId: profile.providerUserId,
  });

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// Returns which providers are available (for the login page UI)
router.get("/auth/providers", (_req: Request, res: Response) => {
  const available = VALID_PROVIDERS.filter(isProviderConfigured);
  res.json({ providers: available });
});

router.get("/login/:provider", (req: Request, res: Response, next) => {
  const { provider } = req.params;
  if (!isValidProvider(provider) || !isProviderConfigured(provider)) {
    res.status(404).json({ error: "Unknown or unconfigured provider" });
    return;
  }

  const returnTo = getSafeReturnTo(req.query.returnTo);
  res.cookie("return_to", returnTo, {
    httpOnly: true,
    secure: IS_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  passport.authenticate(provider, {
    scope: PROVIDER_SCOPES[provider],
    session: false,
  })(req, res, next);
});

// Keep the legacy /login route working (defaults to google)
router.get("/login", (req: Request, res: Response, next) => {
  const returnTo = getSafeReturnTo(req.query.returnTo);
  res.cookie("return_to", returnTo, {
    httpOnly: true,
    secure: IS_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  if (!isProviderConfigured("google")) {
    res.status(503).json({ error: "No auth providers configured" });
    return;
  }
  passport.authenticate("google", {
    scope: PROVIDER_SCOPES["google"],
    session: false,
  })(req, res, next);
});

router.get(
  "/callback/:provider",
  (req: Request, res: Response, next) => {
    const { provider } = req.params;
    if (!isValidProvider(provider) || !isProviderConfigured(provider)) {
      res.redirect("/?error=unknown_provider");
      return;
    }
    passport.authenticate(provider, {
      session: false,
      failureRedirect: "/?error=auth_failed",
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    const provider = req.params.provider as Provider;
    const profile = req.user as unknown as NormalisedProfile;
    const dbUser = await upsertUserFromIdentity(provider, profile);

    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        lastNameInitial: dbUser.lastNameInitial,
        displayName: dbUser.displayName,
        profileImageUrl: dbUser.profileImageUrl,
        isAdmin: dbUser.isAdmin,
        isApproved: dbUser.isApproved,
      },
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    const returnTo = getSafeReturnTo(req.cookies?.return_to);
    res.clearCookie("return_to", { path: "/" });
    res.redirect(returnTo);
  },
);

// Legacy /callback — keep working for existing Google OAuth apps that still
// point to the old callback URL
router.get(
  "/callback",
  (req: Request, res: Response, next) => {
    if (!isProviderConfigured("google")) {
      res.redirect("/?error=auth_failed");
      return;
    }
    passport.authenticate("google", {
      session: false,
      failureRedirect: "/?error=auth_failed",
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    const profile = req.user as unknown as NormalisedProfile;
    const dbUser = await upsertUserFromIdentity("google", profile);

    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        lastNameInitial: dbUser.lastNameInitial,
        displayName: dbUser.displayName,
        profileImageUrl: dbUser.profileImageUrl,
        isAdmin: dbUser.isAdmin,
        isApproved: dbUser.isApproved,
      },
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    const returnTo = getSafeReturnTo(req.cookies?.return_to);
    res.clearCookie("return_to", { path: "/" });
    res.redirect(returnTo);
  },
);

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

router.put("/auth/profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { firstName, lastNameInitial } = req.body;
  if (!firstName || !lastNameInitial) {
    res
      .status(400)
      .json({ error: "firstName and lastNameInitial are required" });
    return;
  }

  const displayName = `${firstName} ${lastNameInitial}.`;

  const [updated] = await db
    .update(usersTable)
    .set({ firstName, lastNameInitial, displayName, updatedAt: new Date() })
    .where(eq(usersTable.id, (req.user as any).id))
    .returning();

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      session.user = {
        ...session.user,
        firstName: updated.firstName,
        lastNameInitial: updated.lastNameInitial,
        displayName: updated.displayName,
      };
      await updateSession(sid, session);
    }
  }

  res.json(updated);
});

export default router;
