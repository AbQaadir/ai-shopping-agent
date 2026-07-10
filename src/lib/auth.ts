import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Session, User } from "@supabase/supabase-js";

export interface VerifiedUser {
  /** The cryptographically verified user ID from Supabase JWT, or "guest" for unauthenticated requests. */
  userId: string;
  /** True when no valid Supabase session is present. */
  isGuest: boolean;
  /** The full Supabase User object (null for guest). */
  user: User | null;
  /** The full Supabase Session object (null for guest). */
  session: Session | null;
}

/**
 * Validates the Supabase JWT from the request's HttpOnly session cookie and
 * returns the verified user identity.
 *
 * IMPORTANT: This uses `supabase.auth.getUser()`, NOT `getSession()`.
 * - `getSession()` only reads the cookie value without server-side verification.
 * - `getUser()` makes a server-to-server call to Supabase to validate the JWT
 *   signature, making it the ONLY secure choice for authorization decisions.
 *
 * For unauthenticated requests (no cookie, or expired token), this returns
 * { userId: "guest", isGuest: true, user: null, session: null } so the
 * existing guest user flow continues to work unchanged.
 *
 * Usage in any API route:
 * ```ts
 * const { userId, isGuest } = await getVerifiedUser();
 * if (isGuest) return new Response("Unauthorized", { status: 401 });
 * ```
 */
export async function getVerifiedUser(): Promise<VerifiedUser> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Silently ignore — setAll called from a context that cannot set cookies
            }
          },
        },
      }
    );

    // getUser() validates the JWT with Supabase servers (secure for authz decisions)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { userId: "guest", isGuest: true, user: null, session: null };
    }

    // Also retrieve the session object for downstream use (e.g., access_token)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      userId: user.id,
      isGuest: false,
      user,
      session,
    };
  } catch (err) {
    // If Supabase env vars are missing or any unexpected error occurs,
    // fall back to guest mode to avoid breaking the app
    console.warn("[auth] getVerifiedUser failed, falling back to guest:", err);
    return { userId: "guest", isGuest: true, user: null, session: null };
  }
}
