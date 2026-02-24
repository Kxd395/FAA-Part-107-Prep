import crypto from "node:crypto";

const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
const DEFAULT_DEV_MAGIC_SECRET = "part107-dev-magic-link-secret";

interface MagicLinkPayload {
  email: string;
  exp: number;
  nonce: string;
}

function getMagicSecret(): string {
  return process.env.MAGIC_LINK_SECRET?.trim() || DEFAULT_DEV_MAGIC_SECRET;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

// ─── Email Validation ───

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  if (!value || value.length > 254) return false;
  return EMAIL_REGEX.test(value);
}

// ─── Token Creation / Verification ───

export function createMagicLinkToken(email: string): string {
  const payload: MagicLinkPayload = {
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, getMagicSecret());
  return `magic.${encodedPayload}.${signature}`;
}

export function verifyMagicLinkToken(token: string): { email: string } | null {
  if (!token.startsWith("magic.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const encodedPayload = parts[1];
  const actualSignature = parts[2];
  const expectedSignature = sign(encodedPayload, getMagicSecret());

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(actualSignature)
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as MagicLinkPayload;
    if (!payload?.email || !isValidEmail(payload.email)) return null;
    if (!payload.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

// ─── Send Magic Link ───

export interface SendMagicLinkResult {
  sent: boolean;
  /** Only populated in dev/console mode for testing */
  devUrl?: string;
}

export async function sendMagicLink(
  email: string,
  baseUrl: string
): Promise<SendMagicLinkResult> {
  const token = createMagicLinkToken(email);
  const verifyUrl = `${baseUrl}/login?token=${encodeURIComponent(token)}`;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (resendApiKey) {
    // Production: send via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL?.trim() || "Part 107 Prep <noreply@part107prep.com>",
        to: [email],
        subject: "Sign in to Part 107 Prep",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Part 107 Prep</h2>
            <p>Click the link below to sign in. This link expires in 15 minutes.</p>
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign In →</a>
            <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to send magic link email: ${errorBody}`);
    }

    return { sent: true };
  }

  // Dev mode: log to console
  console.log("\n─── Magic Link (dev) ───");
  console.log(`  Email: ${email}`);
  console.log(`  URL:   ${verifyUrl}`);
  console.log("────────────────────────\n");

  return { sent: true, devUrl: verifyUrl };
}
