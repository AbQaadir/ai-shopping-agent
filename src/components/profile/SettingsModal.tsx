"use client";

import React, { useState } from "react";
import { X, User, MapPin, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSourcing } from "@/context/SourcingContext";
import AddressManager from "./AddressManager";
import type { UserAddress } from "@/types/sourcing";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "profile" | "addresses";

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, signOut } = useAuth();
  const { userAddresses, setUserAddresses } = useSourcing();

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSavingAddresses, setIsSavingAddresses] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen || !user) return null;

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = user?.user_metadata?.full_name || "User";
  const initials = displayName.substring(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name, phone: phone || undefined }),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAddresses = async (updated: UserAddress[]) => {
    setIsSavingAddresses(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, addresses: updated }),
      });
      if (res.ok) {
        setUserAddresses(updated);
      }
    } catch (err) {
      console.error("Failed to save addresses:", err);
    } finally {
      setIsSavingAddresses(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] animate-fadeIn">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative w-full max-w-[740px] bg-white rounded-xl overflow-hidden border border-slate-100 shadow-2xl flex flex-col md:flex-row animate-slideUp max-h-[88vh]">

        {/* Left User Identity Panel */}
        <div className="w-full md:w-[260px] shrink-0 bg-slate-50 flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-slate-100 select-none relative">
          {/* Subtle grid pattern for premium Windows app feel */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#402970_1px,transparent_1px)] [background-size:12px_12px]" />
          
          {/* Subtle brand color glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-50/50 via-transparent to-[#402970]/5 opacity-40" />

          {/* User identity details */}
          <div className="flex flex-col items-center gap-4 text-center z-10 w-full">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover shrink-0 ring-4 ring-[#402970]/15 shadow-md bg-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#402970] to-purple-500 flex items-center justify-center font-extrabold text-2xl text-white shrink-0 shadow-md">
                {initials}
              </div>
            )}
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug">{displayName}</h4>
              <p className="text-xs text-slate-400 font-medium leading-none">{user.email}</p>
            </div>

            <div className="flex items-center gap-1.5 mt-2 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Google Sync</span>
            </div>
          </div>
        </div>

        {/* Right Tab Contents & Form Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative max-h-[88vh]">
          {/* Floating Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer z-10"
          >
            <X size={16} />
          </button>

          {/* Title Header */}
          <div className="px-8 pt-8 pb-4 shrink-0 flex flex-col gap-1">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Settings</h3>
            <p className="text-xs text-slate-400 font-medium">Manage your profile and delivery preferences.</p>
          </div>

          {/* Tabs Selector */}
          <div className="flex px-8 border-b border-slate-100 shrink-0 gap-6">
            {([ ["profile", "Profile", User], ["addresses", "Delivery Profiles", MapPin] ] as [Tab, string, React.ElementType][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 outline-none ${
                  activeTab === id
                    ? "border-[#402970] text-[#402970]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Tab Scroll Content */}
          <div className="overflow-y-auto flex-1">
            
            {/* ── Profile Tab ────────────────────────────── */}
            {activeTab === "profile" && (
              <div className="p-8 flex flex-col gap-6">
                {/* Display Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                  />
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-sm font-bold text-slate-700 shrink-0">
                      🇱🇰 +94
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="77 123 4567"
                      className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Save & Sign-Out Actions */}
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full flex items-center justify-center gap-2 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-3 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                  >
                    {isSavingProfile
                      ? <><Loader2 size={14} className="animate-spin" /> Saving changes…</>
                      : profileSaved
                      ? <><CheckCircle2 size={14} /> Profile Saved!</>
                      : "Save Changes"}
                  </button>

                  <div className="flex items-center my-1.5">
                    <div className="h-px bg-slate-100 flex-1" />
                    <span className="text-[10px] text-slate-300 font-bold uppercase px-3">or</span>
                    <div className="h-px bg-slate-100 flex-1" />
                  </div>

                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 disabled:opacity-60 font-bold text-xs py-3 rounded-lg transition-all cursor-pointer"
                  >
                    {isSigningOut
                      ? <><Loader2 size={14} className="animate-spin" /> Signing out…</>
                      : <><LogOut size={14} /> Log Out</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Delivery Profiles Tab ──────────────────── */}
            {activeTab === "addresses" && (
              <div className="p-8">
                <div className="mb-4">
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Save your <strong className="text-slate-700">Home</strong>, <strong className="text-slate-700">Work</strong>, and custom delivery locations here. 
                    In chat, just say <em className="text-slate-600 font-semibold">"deliver to home"</em> and the AI will use the correct address automatically.
                  </p>
                </div>
                <AddressManager
                  addresses={userAddresses}
                  onSave={handleSaveAddresses}
                  isSaving={isSavingAddresses}
                />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
