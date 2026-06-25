import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withLogging } from "@/lib/logger";

/**
 * GET /auth/callback
 *
 * Supabase redirects here after the user completes Google OAuth.
 * This handler exchanges the one-time `code` for a real session,
 * sets the session cookie, then redirects the user into the app.
 *
 * Required in Railway (and any non-Vercel) deployment because
 * Supabase needs a server-side route to finalize the OAuth handshake.
 */
export const GET = withLogging(async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Where to send the user after sign-in (default: home page)
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Use the forwarded host header in production so Railway's proxy works
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If something went wrong, redirect to home with an error flag
  console.error("Auth callback error: no code or exchange failed");
  return NextResponse.redirect(`${origin}/?auth_error=true`);
});

