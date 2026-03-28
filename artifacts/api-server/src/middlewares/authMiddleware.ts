import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { clearSession, getSessionId, getSession } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Re-fetch approval/admin status from DB so revoked users are blocked immediately
  const [dbUser] = await db
    .select({ isAdmin: usersTable.isAdmin, isApproved: usersTable.isApproved })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);

  if (!dbUser) {
    // User was deleted from the database
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = { ...session.user, isAdmin: dbUser.isAdmin, isApproved: dbUser.isApproved };
  next();
}
