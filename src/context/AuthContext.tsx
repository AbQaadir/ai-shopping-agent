"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthModalOpen: boolean;
  authModalReason: "message_limit" | "checkout" | null;
  openAuthModal: (reason: "message_limit" | "checkout") => void;
  closeAuthModal: () => void;
  /** True after a brand-new Google sign-in where profileComplete === false */
  showProfileSetup: boolean;
  setShowProfileSetup: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<"message_limit" | "checkout" | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user && _event === 'SIGNED_IN') {
        const guestId = localStorage.getItem("kapruka_guest_uuid");
        fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId }),
        })
          .then(res => res.json())
          .then((data) => {
            console.log("Database user synced successfully.");
            localStorage.removeItem("kapruka_guest_uuid");
            // Show profile setup modal if this user hasn't completed their profile
            if (data.profileComplete === false) {
              setShowProfileSetup(true);
            }
          })
          .catch((err) => console.error("Database user sync failed:", err));

        closeAuthModal();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL || `${window.location.origin}/`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const openAuthModal = (reason: "message_limit" | "checkout") => {
    setAuthModalReason(reason);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalReason(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signInWithGoogle,
        signOut,
        isAuthModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        showProfileSetup,
        setShowProfileSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
