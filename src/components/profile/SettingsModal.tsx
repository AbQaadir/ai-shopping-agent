"use client";

import React, { useState } from "react";
import { X, User, MapPin, Loader2, CheckCircle2 } from "lucide-react";
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
  const { user } = useAuth();
  const { userAddresses, setUserAddresses } = useSourcing();

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSavingAddresses, setIsSavingAddresses] = useState(false);

  if (!isOpen || !user) return null;

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

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-slideUp max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-800">Settings</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors outline-none cursor-pointer">
            <X size={17} />
          </button>
        </div>

        {/* User identity */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#402970]/10 flex items-center justify-center font-extrabold text-sm text-[#402970] shrink-0">
            {(user.user_metadata?.full_name || user.email || "U").substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{user.user_metadata?.full_name || "User"}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {([["profile", "Profile", User], ["addresses", "Addresses", MapPin]] as [Tab, string, React.ElementType][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
                activeTab === id
                  ? "border-[#402970] text-[#402970]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Phone Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm font-bold text-slate-700 shrink-0">
                    🇱🇰 +94
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="77 123 4567"
                    className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Email</label>
                <input
                  type="email"
                  value={user.email || ""}
                  disabled
                  className="w-full border border-slate-100 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400">Managed by Google. Cannot be changed here.</p>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="flex items-center justify-center gap-2 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {isSavingProfile
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : profileSaved
                  ? <><CheckCircle2 size={14} /> Saved!</>
                  : "Save Changes"}
              </button>
            </div>
          )}

          {/* Addresses Tab */}
          {activeTab === "addresses" && (
            <div className="p-4">
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
  );
}
