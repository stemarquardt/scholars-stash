import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";

// Provider metadata
const PROVIDERS = [
  {
    id: "google",
    label: "Continue with Google",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
    className:
      "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm hover:shadow",
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path
          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
          fill="#1877F2"
        />
      </svg>
    ),
    className:
      "bg-[#1877F2] hover:bg-[#166fe5] text-white border border-transparent shadow-sm hover:shadow",
  },
  {
    id: "discord",
    label: "Continue with Discord",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path
          d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          fill="white"
        />
      </svg>
    ),
    className:
      "bg-[#5865F2] hover:bg-[#4752c4] text-white border border-transparent shadow-sm hover:shadow",
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function OwlIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-10 h-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="12" cy="14" rx="6" ry="7" fill="currentColor" opacity="0.18" />
      <ellipse cx="12" cy="14" rx="6" ry="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9.5" cy="11" r="2" fill="currentColor" opacity="0.85" />
      <circle cx="14.5" cy="11" r="2" fill="currentColor" opacity="0.85" />
      <circle cx="9.5" cy="11" r="0.8" style={{ fill: "white" }} />
      <circle cx="14.5" cy="11" r="0.8" style={{ fill: "white" }} />
      <path d="M11 13l1 1.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <path d="M9 7.5C9 6 8 5 7 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 7.5C15 6 16 5 17 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="8.5" y="4.5" width="7" height="1.2" rx="0.4" fill="currentColor" opacity="0.7" />
      <path d="M12 4.5v-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [availableProviders, setAvailableProviders] = useState<ProviderId[] | null>(null);

  // Redirect already-logged-in users away
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  // Fetch which providers are enabled on the server
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((data: { providers: ProviderId[] }) => setAvailableProviders(data.providers))
      .catch(() => setAvailableProviders(["google"])); // fallback
  }, []);

  const handleProviderLogin = (providerId: ProviderId) => {
    window.location.href = `/api/login/${providerId}?returnTo=/`;
  };

  const visibleProviders = availableProviders
    ? PROVIDERS.filter((p) => availableProviders.includes(p.id))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-background to-primary/5 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl text-primary-foreground shadow-xl shadow-primary/25 mb-5">
            <OwlIcon />
          </div>
          <h1 className="text-3xl text-foreground tracking-tight leading-tight">
            <span style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }} className="font-bold italic">
              Scholars'
            </span>{" "}
            <span style={{ fontFamily: "'Righteous', sans-serif" }} className="text-accent">
              Stash
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            Stephen &amp; Whitney's homeschool resource hub
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl border border-border/60 shadow-xl p-8 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how you'd like to sign in
            </p>
          </div>

          {availableProviders === null ? (
            // Loading skeleton
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : visibleProviders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No sign-in methods are configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderLogin(provider.id)}
                  className={`w-full flex items-center justify-center gap-3 h-12 rounded-xl font-semibold text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${provider.className}`}
                >
                  {provider.icon}
                  {provider.label}
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground pt-2 leading-relaxed">
            This is a private site for friends &amp; family. Stephen or Whitney will approve your account once you sign up.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <button onClick={() => navigate("/")} className="hover:underline hover:text-foreground transition-colors">
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
