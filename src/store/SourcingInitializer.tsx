"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { useAuth } from "@/context/AuthContext";
import { useSourcingStore } from "./useSourcingStore";
import type { UserAddress } from "@/types/sourcing";

export function SourcingInitializer({ children }: { children: React.ReactNode }) {
  const { user, isSyncing, openAuthModal } = useAuth();
  const router = useRouter();
  
  const [guestId, setGuestId] = useState<string>("");

  const setCountry = useSourcingStore(state => state.setCountry);
  const setCurrency = useSourcingStore(state => state.setCurrency);
  const setUserAddresses = useSourcingStore(state => state.setUserAddresses);
  const setCartItems = useSourcingStore(state => state.setCartItems);
  
  const activeHistoryId = useSourcingStore(state => state.activeHistoryId);
  const fetchSessionAndHydrate = useSourcingStore(state => state.fetchSessionAndHydrate);
  const handleResetLocal = useSourcingStore(state => state.handleResetLocal);
  const handleOrderCart = useSourcingStore(state => state.handleOrderCart);

  // 1. Manage Guest ID
  useEffect(() => {
    if (!user) {
      let id = localStorage.getItem("kapruka_guest_uuid");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("kapruka_guest_uuid", id);
      }
      setGuestId(id);
    }
  }, [user]);

  const activeUserId = user?.id || guestId || "guest-pending";

  // 2. Load User Addresses
  useEffect(() => {
    if (!user?.id) {
      setUserAddresses([]);
      return;
    }
    fetch(`/api/user/profile?userId=${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.addresses && Array.isArray(data.addresses)) {
          setUserAddresses(data.addresses as UserAddress[]);
        }
      })
      .catch(err => console.warn("Failed to load user addresses:", err));
  }, [user?.id, setUserAddresses]);

  // 3. Location and Currency Detection (IP based)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const persistedCountry = Cookies.get("kapruka_country");
      const persistedCurrency = Cookies.get("kapruka_currency");

      if (!persistedCountry && !persistedCurrency) {
        const detectLocation = async () => {
          let countryCode: string | null = null;
          try {
            const res = await fetch("https://ipapi.co/json/");
            if (res.ok) {
              const data = await res.json();
              if (data.country_code) {
                countryCode = data.country_code.toUpperCase();
              }
            }
          } catch (err) {
            console.warn("Location detection failed.", err);
          }

          if (countryCode) {
            setCountry(countryCode);
            if (countryCode === "LK") {
              setCurrency("LKR");
            } else {
              setCurrency("USD");
            }
          } else {
            setCountry("LK");
            setCurrency("LKR");
          }
        };
        detectLocation();
      }
    }
  }, [setCountry, setCurrency]);

  // 4. Hydrate Cart on Session Change
  useEffect(() => {
    if (isSyncing) return;
    const loadCart = async () => {
      if (!activeUserId) return;
      if (!activeHistoryId) {
        setCartItems([]);
        return;
      }
      try {
        const res = await fetch(`/api/session?cartOnly=true&userId=${activeUserId}&sessionId=${activeHistoryId}&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setCartItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load user session cart:", err);
      }
    };
    loadCart();
  }, [activeUserId, activeHistoryId, isSyncing, setCartItems]);

  // 5. Popstate Event Listener for Browser Navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/c/")) {
        const id = path.split("/c/")[1];
        if (id) {
          useSourcingStore.setState({ activeHistoryId: id, isChatting: true });
          fetchSessionAndHydrate(id, activeUserId, router);
        }
      } else {
        handleResetLocal();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [fetchSessionAndHydrate, handleResetLocal, activeUserId, router]);

  // 6. Resume Pending Orders (if user just logged in)
  useEffect(() => {
    if (user && !isSyncing) {
      try {
        const pending = localStorage.getItem("pending_order_products");
        if (pending) {
          const productsToOrder = JSON.parse(pending);
          localStorage.removeItem("pending_order_products");
          if (productsToOrder && productsToOrder.length > 0) {
            setTimeout(() => {
              handleOrderCart(productsToOrder, activeUserId, user, openAuthModal);
            }, 500);
          }
        }
      } catch (e) {
        console.error("Failed to resume pending order", e);
        localStorage.removeItem("pending_order_products");
      }
    }
  }, [user, isSyncing, handleOrderCart, activeUserId, openAuthModal]);

  return <>{children}</>;
}
