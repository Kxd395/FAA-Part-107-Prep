"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { sanitizeReturnUrl } from "../../lib/returnUrl";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdApi {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void | Promise<void>;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: { theme: "outline" | "filled_blue" | "filled_black"; size: "large" | "medium" | "small"; width?: number }
  ) => void;
}

interface GoogleAccountsApi {
  id: GoogleIdApi;
}

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccountsApi;
    };
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const returnUrl = sanitizeReturnUrl(searchParams.get("returnUrl"));

  const { user, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Google GIS element reference
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace(returnUrl);
    }
  }, [user, router, returnUrl]);

  // Handle URL token verification
  useEffect(() => {
    if (tokenFromUrl && !user) {
      verifyMagicLink(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl, user]);

  const verifyMagicLink = async (token: string) => {
    setLoading(true);
    setStatus("Verifying magic link...");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify magic link");
      await refreshSession();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Verification failed");
      setLoading(false);
    }
  };

  const requestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send magic link");

      setMagicLinkSent(true);
      if (data.devUrl) {
        setStatus(`[DEV] Magic Link URL: ${data.devUrl}`);
      } else {
        setStatus("Magic link sent! Check your email to sign in.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to request link");
    } finally {
      setLoading(false);
    }
  };

  // Load Google GIS Script dynamically
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      if (process.env.NODE_ENV !== "development") {
        console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured");
      }
      return;
    }

    const scriptId = "google-gis-script";
    if (document.getElementById(scriptId)) {
      // Script already loaded, just render
      if (window.google?.accounts?.id && googleButtonRef.current) {
        renderGoogleButton(clientId);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        renderGoogleButton(clientId);
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount if needed, though usually fine to leave
      // const existingScript = document.getElementById(scriptId);
      // if (existingScript) document.body.removeChild(existingScript);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderGoogleButton = (clientId: string) => {
    if (!window.google?.accounts?.id || !googleButtonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: GoogleCredentialResponse) => {
        setLoading(true);
        setStatus("Signing in with Google...");
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential }),
          });
          const data = (await res.json()) as { error?: string; code?: string };
          if (!res.ok) {
            const baseMessage = data.error || "Failed to sign in with Google";
            throw new Error(data.code ? `${baseMessage} [${data.code}]` : baseMessage);
          }
          await refreshSession();
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Google sign in failed");
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
    });
  };

  return (
    <div className="mx-auto max-w-sm mt-12 mb-12 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>

      {/* Google Sign-In */}
      <div className="mb-6 flex justify-center w-full min-h-[44px]" ref={googleButtonRef}>
        {/* The GIS script will render the button here. */}
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--card-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--card-bg)] px-2 text-[var(--muted)]">Or sign in with email</span>
        </div>
      </div>

      {magicLinkSent ? (
        <div className="text-center">
          <p className="text-sm text-[var(--muted)] mb-4">
            We sent a secure link to <strong>{email}</strong>
          </p>
          {status && (
            <div className={`p-4 rounded-lg text-sm mb-4 break-all ${status.includes("[DEV]") ? "bg-brand-500/20 text-brand-300" : "bg-emerald-500/20 text-emerald-300"}`}>
              {status}
            </div>
          )}
          <button
            onClick={() => { setMagicLinkSent(false); setStatus(null); }}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={requestMagicLink} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="pilot@example.com"
              className="w-full rounded-md border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm placeholder-[var(--muted)] outline-none focus:border-brand-500 disabled:opacity-50"
            />
          </div>

          {status && !magicLinkSent && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center mt-12 text-[var(--muted)]">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
