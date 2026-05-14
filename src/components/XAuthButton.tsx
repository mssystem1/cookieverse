"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

type XAuthButtonProps = {
  callbackUrl?: string;
  compact?: boolean;
};

function currentPathFallback() {
  if (typeof window === "undefined") return "/";

  const path = window.location.pathname;
  const search = window.location.search || "";

  if (path.startsWith("/api/auth")) return "/";

  return `${path}${search}`;
}

function getAuthErrorFromUrl() {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  return url.searchParams.get("error");
}

function explainAuthError(error: string | null) {
  if (!error) return null;

  if (error === "OAuthCallback") {
    return (
      "X callback failed. Check OAuth 2.0 Client ID/Secret, callback URL, " +
      "NEXTAUTH_URL, and terminal logs."
    );
  }

  if (error === "OAuthSignin") {
    return "Could not start X OAuth. Check X app settings and callback URL.";
  }

  if (error === "OAuthAccountNotLinked") {
    return "This X account is linked to another login method. Use the original account.";
  }

  return `X sign in failed: ${error}`;
}

export default function XAuthButton({
  callbackUrl,
  compact = false,
}: XAuthButtonProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [twitterImage, setTwitterImage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = useMemo(
    () => callbackUrl || currentPathFallback(),
    [callbackUrl],
  );

  useEffect(() => {
    let ignore = false;

    const urlError = getAuthErrorFromUrl();
    if (urlError) {
      setError(explainAuthError(urlError));
    }

    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const data = r.ok ? await r.json() : null;

        if (!ignore) {
          setUsername(data?.twitter_username || null);
          setTwitterImage(data?.twitter_image || null);
        }
      } catch {
        if (!ignore) {
          setUsername(null);
          setTwitterImage(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const startXSignIn = async () => {
    if (isSigningIn) return;

    setError(null);
    setIsSigningIn(true);

    try {
      await signIn("twitter", {
        callbackUrl: returnTo,
        redirect: true,
      });
    } catch (e: any) {
      setIsSigningIn(false);
      setError(e?.message || "Failed to start X sign in.");
    }
  };

  if (username) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: compact ? 10 : 16,
        }}
      >
        {twitterImage && (
          <img
            src={twitterImage.replace("_normal", "_200x200")}
            alt="X avatar"
            width={compact ? 56 : 72}
            height={compact ? 56 : 72}
            style={{
              borderRadius: "50%",
              border: "2px solid rgba(148, 163, 184, 0.6)",
              boxShadow: "0 0 30px rgba(56, 189, 248, 0.35)",
            }}
          />
        )}

        <div
          style={{
            fontSize: compact ? 12 : 13,
            color: "#e5e7eb",
            opacity: 0.9,
          }}
        >
          Connected as <b>@{username}</b>
        </div>

        <a
          href={returnTo}
          style={{
            padding: compact ? "9px 15px" : "10px 18px",
            borderRadius: 9999,
            border: "1px solid #4b5563",
            background:
              "radial-gradient(circle at top left, #22c55e33, #0f172a 45%, #1d4ed833)",
            color: "#f9fafb",
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            textDecoration: "none",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          }}
        >
          Enter app
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 8 }}>
      {error && (
        <div
          style={{
            maxWidth: 360,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(248, 113, 113, 0.45)",
            background: "rgba(127, 29, 29, 0.35)",
            color: "#fecaca",
            fontSize: 12,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={startXSignIn}
        disabled={isSigningIn}
        aria-busy={isSigningIn}
        style={{
          cursor: isSigningIn ? "wait" : "pointer",
          opacity: isSigningIn ? 0.72 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: compact ? "10px 18px" : "12px 22px",
          borderRadius: 9999,
          border: "1px solid rgba(148, 163, 184, 0.6)",
          background:
            "radial-gradient(circle at top left, #38bdf833, #020617 45%, #8b5cf633)",
          color: "#f9fafb",
          textDecoration: "none",
          fontSize: compact ? 13 : 14,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.9)",
          transition:
            "transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.12s ease-out",
        }}
        onMouseEnter={(e) => {
          if (isSigningIn) return;
          e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
          e.currentTarget.style.boxShadow = "0 22px 45px rgba(15,23,42,0.95)";
          e.currentTarget.style.borderColor = "#e5e7eb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.boxShadow = "0 18px 40px rgba(15, 23, 42, 0.9)";
          e.currentTarget.style.borderColor = "rgba(148,163,184,0.6)";
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: compact ? 20 : 22,
            height: compact ? 20 : 22,
            borderRadius: "50%",
            background: "#020617",
            border: "1px solid rgba(148,163,184,0.7)",
            fontSize: compact ? 13 : 14,
            fontWeight: 700,
          }}
        >
          𝕏
        </span>

        <span>{isSigningIn ? "Opening X..." : "Sign in with X"}</span>
      </button>
    </div>
  );
}