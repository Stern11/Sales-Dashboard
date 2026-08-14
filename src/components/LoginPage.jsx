import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../context/AuthContext.jsx";
import { useTheme } from "../hooks/useTheme.js";

/**
 * Shown in place of the whole app until AuthContext reports authenticated.
 * Renders Google's own "Sign In With Google" button (Google Identity
 * Services, loaded via the <script> tag in index.html) rather than a custom
 * button — that script isn't guaranteed to have finished loading by the
 * time this mounts, so init is retried on a short interval instead of
 * assuming `window.google` is already there.
 */
export function LoginPage() {
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuthContext();
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    async function handleCredential(response) {
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth?action=login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Sign-in failed.");
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    }

    function tryInit() {
      if (cancelled) return;
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredential,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          width: 280,
        });
      } else {
        retryTimer = setTimeout(tryInit, 150);
      }
    }
    tryInit();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-badge" src="/icon-96.png" alt="Heizen" width="52" height="52" />
        <div className="login-title">Executive Sales Dashboard</div>
        <p className="subtitle" style={{ marginBottom: 24 }}>
          Sign in with your Heizen Google account to continue.
        </p>
        <div ref={buttonRef} style={{ display: "flex", justifyContent: "center" }} />
        {submitting && <p className="subtitle" style={{ marginTop: 12 }}>Signing in…</p>}
        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
        <p className="login-footer-note">Access is restricted to @heizen.work accounts.</p>
      </div>
    </div>
  );
}
