"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Home, Briefcase, Tag, MapPin, CheckCircle2, ChevronRight, Loader2, Phone, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSourcing } from "@/context/SourcingContext";
import type { UserAddress } from "@/types/sourcing";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ADDRESS_TYPES = [
  { value: "home" as const, label: "Home", icon: Home },
  { value: "work" as const, label: "Work", icon: Briefcase },
  { value: "custom" as const, label: "Custom", icon: Tag },
];

const SRI_LANKA_CENTER = { lat: 7.8731, lng: 80.7718 };

export default function ProfileSetupModal({ isOpen, onClose }: ProfileSetupModalProps) {
  const { user, setShowProfileSetup } = useAuth();
  const { setUserAddresses } = useSourcing();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 fields
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");

  // Step 2 fields
  const [addressText, setAddressText] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [formattedAddress, setFormattedAddress] = useState("");
  const [city, setCity] = useState("");
  const [markerLatLng, setMarkerLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [addressType, setAddressType] = useState<"home" | "work" | "custom">("home");
  const [customLabel, setCustomLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [mapReady, setMapReady] = useState(false);

  // Imperative map refs — same pattern as CheckoutCard
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const isAdvancedMarkerRef = useRef(false);
  const mapsInitialisedRef = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────
  const extractCity = (components: any[]) => {
    const comp = components?.find(
      (c: any) => c.types.includes("locality") || c.types.includes("administrative_area_level_2")
    );
    return comp?.long_name || "";
  };

  const updateMarkerAndReverse = (latLng: any) => {
    if (!latLng) return;
    const g = (window as any).google;
    const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
    const pos = { lat, lng };

    setMarkerLatLng(pos);

    // Move marker imperatively
    if (markerInstanceRef.current) {
      if (isAdvancedMarkerRef.current) {
        markerInstanceRef.current.position = new g.maps.LatLng(lat, lng);
      } else {
        markerInstanceRef.current.setPosition(pos);
      }
    }

    // Reverse geocode with SDK Geocoder
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: pos }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          setFormattedAddress(results[0].formatted_address);
          setCity(extractCity(results[0].address_components));
        }
      });
    }
  };

  // ── Initialise Google Map (imperative) ─────────────────────────
  const initMap = async () => {
    if (!mapDivRef.current || mapsInitialisedRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;
    mapsInitialisedRef.current = true;

    try {
      let MapClass: any;
      let GeocoderClass: any;
      let MarkerClass: any;
      let isAdv = false;

      if (g.maps.importLibrary) {
        const [mapsLib, geoLib, markerLib] = await Promise.all([
          g.maps.importLibrary("maps"),
          g.maps.importLibrary("geocoding"),
          g.maps.importLibrary("marker"),
        ]);
        MapClass = mapsLib.Map;
        GeocoderClass = geoLib.Geocoder;
        if (markerLib.AdvancedMarkerElement) {
          MarkerClass = markerLib.AdvancedMarkerElement;
          isAdv = true;
        } else {
          MarkerClass = markerLib.Marker || g.maps.Marker;
        }
      } else {
        MapClass = g.maps.Map;
        GeocoderClass = g.maps.Geocoder;
        MarkerClass = g.maps.Marker;
        if (g.maps.marker?.AdvancedMarkerElement) {
          MarkerClass = g.maps.marker.AdvancedMarkerElement;
          isAdv = true;
        }
      }

      isAdvancedMarkerRef.current = isAdv;

      const map = new MapClass(mapDivRef.current, {
        center: SRI_LANKA_CENTER,
        zoom: 7,
        mapId: "kapruka_profile_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        clickableIcons: false,
      });
      mapInstanceRef.current = map;

      // Geocoder
      geocoderRef.current = new GeocoderClass();

      // Purple draggable marker — hidden until Find is clicked
      const markerEl = document.createElement("div");
      markerEl.style.cssText =
        "width:22px;height:22px;background:#402970;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:grab;display:none";

      let marker: any;
      if (isAdv) {
        marker = new MarkerClass({
          position: SRI_LANKA_CENTER,
          map,
          content: markerEl,
          gmpDraggable: true,
        });
        marker.addListener("gmp-dragend", () => updateMarkerAndReverse(marker.position));
        marker.addListener("dragend", (e: any) => updateMarkerAndReverse(e.latLng || marker.position));
      } else {
        marker = new MarkerClass({
          position: SRI_LANKA_CENTER,
          map,
          draggable: true,
          visible: false,
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png" },
        });
        marker.addListener("dragend", (e: any) => updateMarkerAndReverse(e.latLng));
      }
      markerInstanceRef.current = marker;

      // Map click → move marker
      map.addListener("click", (e: any) => updateMarkerAndReverse(e.latLng));

      setMapReady(true);
    } catch (err) {
      console.error("Maps init error:", err);
    }
  };

  // ── Load Maps script when step 2 is shown ─────────────────────
  useEffect(() => {
    if (step !== 2 || !MAPS_API_KEY) return;

    if ((window as any).google?.maps) {
      setTimeout(initMap, 50);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places,marker&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    if ((script as any)._mapsLoaded) {
      setTimeout(initMap, 50);
      return;
    }

    const onLoad = () => {
      (script as any)._mapsLoaded = true;
      setTimeout(initMap, 50);
    };
    script.addEventListener("load", onLoad);
    return () => script!.removeEventListener("load", onLoad);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Find button — SDK Geocoder ─────────────────────────────────
  const handleGeocode = () => {
    if (!addressText.trim() || !geocoderRef.current) return;
    setIsGeocoding(true);

    geocoderRef.current.geocode(
      { address: addressText + ", Sri Lanka" },
      (results: any, status: any) => {
        setIsGeocoding(false);
        if (status === "OK" && results[0]) {
          const loc = results[0].geometry.location;
          const pos = { lat: loc.lat(), lng: loc.lng() };
          setMarkerLatLng(pos);
          setFormattedAddress(results[0].formatted_address);
          setCity(extractCity(results[0].address_components));

          // Pan map and show marker
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo(pos);
            mapInstanceRef.current.setZoom(14);
          }

          const marker = markerInstanceRef.current;
          if (marker) {
            if (isAdvancedMarkerRef.current) {
              const g = (window as any).google;
              marker.position = new g.maps.LatLng(pos.lat, pos.lng);
              // Show the marker div
              if (marker.content) (marker.content as HTMLElement).style.display = "block";
            } else {
              marker.setPosition(pos);
              marker.setVisible(true);
            }
          }
        } else {
          console.warn("Geocode failed:", status);
        }
      }
    );
  };

  // ── Step handlers ──────────────────────────────────────────────
  const handleStep1Continue = () => {
    if (!phone.trim()) return;
    setRecipientName(name);
    setRecipientPhone(phone);
    setStep(2);
  };

  const handleSaveAddress = async () => {
    if (!markerLatLng && !addressText.trim()) return;
    setIsSaving(true);
    try {
      const newAddress: UserAddress = {
        id: crypto.randomUUID(),
        type: addressType,
        label:
          addressType === "custom"
            ? customLabel || "Custom"
            : addressType === "home"
            ? "Home"
            : "Work",
        recipientName: recipientName || name,
        phone: recipientPhone || phone,
        addressLine: addressText,
        city,
        lat: markerLatLng?.lat,
        lng: markerLatLng?.lng,
        formattedAddress: formattedAddress || addressText,
        isDefault: true,
      };

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          name,
          phone,
          addresses: [newAddress],
          profileComplete: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUserAddresses(Array.isArray(data.addresses) ? data.addresses : [newAddress]);
        setStep(3);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setShowProfileSetup(false);
    onClose();
  };

  const handleDone = () => {
    setShowProfileSetup(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0" onClick={handleSkip} />

      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-slideUp">
        {/* Progress bar */}
        {step < 3 && (
          <div className="w-full h-1 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#402970] to-[#6a42c0] transition-all duration-500"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {step === 1 && "Complete Your Profile"}
              {step === 2 && "Add Your Delivery Address"}
              {step === 3 && "You're All Set! 🎉"}
            </h3>
            {step < 3 && (
              <p className="text-[11px] text-slate-400 mt-0.5">Step {step} of 2</p>
            )}
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors outline-none cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Step 1: Personal Info ─────────────────────────────── */}
        {step === 1 && (
          <div className="p-6 flex flex-col gap-5">
            {/* Welcome */}
            <div className="flex items-center gap-3 bg-[#402970]/5 rounded-xl p-4 border border-[#402970]/10">
              <div className="w-12 h-12 rounded-full bg-[#402970]/10 flex items-center justify-center text-[#402970] font-extrabold text-base shrink-0">
                {name?.substring(0, 2).toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Welcome to Kapruka AI!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Let&apos;s set up your profile so we can deliver orders right to you.
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <User size={12} className="text-[#402970]" /> Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
              />
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Phone size={12} className="text-[#402970]" /> Phone Number
              </label>
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
              <p className="text-[10px] text-slate-400">Needed for delivery coordination.</p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                Skip for now
              </button>
              <button
                onClick={handleStep1Continue}
                disabled={!phone.trim()}
                className="flex items-center gap-2 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Continue <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Address ────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-6 flex flex-col gap-4">
            {/* Address input + Find button */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-[#402970]" /> Rough Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addressText}
                  onChange={e => setAddressText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGeocode()}
                  placeholder="e.g. Nugegoda, Colombo"
                  className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                />
                <button
                  onClick={handleGeocode}
                  disabled={isGeocoding || !addressText.trim() || !mapReady}
                  className="flex items-center gap-1.5 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {isGeocoding ? "Finding…" : !mapReady ? "Loading…" : "Find"}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">Drag the pin on the map to set your exact location.</p>
            </div>

            {/* Map container — always in DOM, map initialised imperatively */}
            <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              {/* Placeholder shown until first geocode */}
              {!markerLatLng && (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-400 text-xs flex-col gap-2 bg-slate-100 rounded-xl pointer-events-none">
                  <MapPin size={28} className="text-slate-300" />
                  <span>Type a location above and click &quot;Find&quot;</span>
                </div>
              )}
              <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
            </div>

            {formattedAddress && (
              <p className="text-[11px] text-[#402970] font-semibold bg-[#402970]/5 rounded-lg px-3 py-2 border border-[#402970]/10 truncate">
                📍 {formattedAddress}
              </p>
            )}

            {/* Address type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Address Type</label>
              <div className="flex gap-2">
                {ADDRESS_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setAddressType(value)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex-1 justify-center ${
                      addressType === value
                        ? "bg-[#402970] border-[#402970] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#402970]/30"
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
              {addressType === "custom" && (
                <input
                  type="text"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="e.g. Girlfriend's Place"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                />
              )}
            </div>

            {/* Recipient */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Recipient Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Who receives here?"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contact Phone</label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  placeholder="+94 77..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                Skip for now
              </button>
              <button
                onClick={handleSaveAddress}
                disabled={isSaving || (!markerLatLng && !addressText.trim())}
                className="flex items-center gap-2 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {isSaving ? "Saving…" : "Save Address"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="p-8 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center animate-bounceIn">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-slate-800 mb-1">Profile Complete!</h4>
              <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                Your name, phone, and delivery address are saved. You can manage them anytime from the sidebar settings.
              </p>
            </div>
            <button
              onClick={handleDone}
              className="bg-[#402970] hover:bg-[#33205a] text-white font-bold text-sm px-8 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#402970]/20"
            >
              Start Shopping 🛍️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
