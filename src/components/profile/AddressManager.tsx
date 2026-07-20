"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Home, Briefcase, Tag, MapPin, Star, Pencil, Trash2, CheckCircle2, ChevronRight, Loader2, Plus, X } from "lucide-react";
import type { UserAddress, CitySuggestion } from "@/types/sourcing";
import { KAPRUKA_CITIES, KAPRUKA_CITIES_SET } from "@/constants/cities";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SRI_LANKA_CENTER = { lat: 7.8731, lng: 80.7718 };

const ADDRESS_TYPES = [
  { value: "home" as const, label: "Home", icon: Home },
  { value: "work" as const, label: "Work", icon: Briefcase },
  { value: "custom" as const, label: "Custom", icon: Tag },
];

function typeIcon(type: UserAddress["type"]) {
  if (type === "home") return <Home size={14} />;
  if (type === "work") return <Briefcase size={14} />;
  return <Tag size={14} />;
}


// ─────────────────────────────────────────────────────────────────
interface AddressFormProps {
  initial?: Partial<UserAddress>;
  onSave: (addr: UserAddress) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function AddressForm({ initial, onSave, onCancel, isSaving }: AddressFormProps) {
  const [addressText, setAddressText] = useState(initial?.addressLine || "");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState(
    initial?.lat ? { lat: initial.lat, lng: initial.lng! } : SRI_LANKA_CENTER
  );
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(
    initial?.lat ? { lat: initial.lat, lng: initial.lng! } : null
  );
  const [formattedAddress, setFormattedAddress] = useState(initial?.formattedAddress || "");
  const [city, setCity] = useState(initial?.city || "");
  const [addressType, setAddressType] = useState<"home" | "work" | "custom">(initial?.type || "home");
  const [customLabel, setCustomLabel] = useState(initial?.type === "custom" ? initial.label || "" : "");
  const [customLabelError, setCustomLabelError] = useState("");
  const [recipientName, setRecipientName] = useState(initial?.recipientName || "");
  const [recipientPhone, setRecipientPhone] = useState(initial?.phone || "");
  const [mapShown, setMapShown] = useState(!!initial?.lat);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCityChange = (val: string) => {
    setCity(val);
    if (val.trim().length >= 1) {
      const searchVal = val.toLowerCase();
      const filtered = KAPRUKA_CITIES.filter((c) =>
        c.toLowerCase().includes(searchVal)
      )
      .slice(0, 10)
      .map((name) => ({ name }));
      setCitySuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setCitySuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (cityName: string) => {
    setCity(cityName);
    setShowSuggestions(false);
  };

  const handleGeocode = async () => {
    if (!addressText.trim()) return;
    const google = (window as any).google;
    if (!google || !google.maps || !google.maps.Geocoder) {
      alert("Google Maps is still loading. Please try again in a moment.");
      return;
    }
    setIsGeocoding(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ address: addressText + ", Sri Lanka" });
      if (response.results?.[0]) {
        const result = response.results[0];
        const loc = result.geometry.location;
        const latLng = { lat: loc.lat(), lng: loc.lng() };
        setMarkerPos(latLng);
        setFormattedAddress(result.formatted_address);
        // Do not auto-set city to force explicit user selection
        // Reveal map, then pan imperatively
        setMapShown(true);
        if (mapRef.current) {
          mapRef.current.panTo(latLng);
          mapRef.current.setZoom(14);
        } else {
          // Map not yet mounted — fall back to updating center state
          setMapCenter(latLng);
        }
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleReverseGeocode = useCallback(async (lat: number, lng: number) => {
    const google = (window as any).google;
    if (!google || !google.maps || !google.maps.Geocoder) return;
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results?.[0]) {
        const result = response.results[0];
        setFormattedAddress(result.formatted_address);
        // Do not auto-set city to force explicit user selection
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    }
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    handleReverseGeocode(lat, lng);
  }, [handleReverseGeocode]);

  const handleSubmit = () => {
    // Validate custom label
    if (addressType === "custom") {
      const trimmed = customLabel.trim().toLowerCase();
      if (!trimmed) {
        setCustomLabelError("Please enter a label for this address.");
        return;
      }
      if (trimmed === "home" || trimmed === "work") {
        setCustomLabelError(`"${customLabel.trim()}" is already a built-in type. Please use a unique name like 'Parents Place' or 'Office 2'.`);
        return;
      }
    }
    setCustomLabelError("");

    if (!city.trim() || !KAPRUKA_CITIES_SET.has(city)) {
      alert("Please select a valid Kapruka delivery city from the suggestions dropdown.");
      return;
    }
    const addr: UserAddress = {
      id: initial?.id || crypto.randomUUID(),
      type: addressType,
      label: addressType === "custom" ? (customLabel || "Custom") : (addressType === "home" ? "Home" : "Work"),
      recipientName,
      phone: recipientPhone,
      addressLine: addressText,
      city,
      lat: markerPos?.lat,
      lng: markerPos?.lng,
      formattedAddress: formattedAddress || addressText,
      isDefault: initial?.isDefault ?? false,
    };
    onSave(addr);
  };
  return (
    <div className="flex flex-col gap-4">
      {/* Address input + Find */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold text-slate-700">Search Delivery Location</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={addressText}
            onChange={e => setAddressText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGeocode()}
            placeholder="e.g. Nugegoda, Colombo"
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white"
          />
          <button
            onClick={handleGeocode}
            disabled={isGeocoding || !addressText.trim()}
            className="flex items-center gap-1.5 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer shadow-sm shrink-0"
          >
            {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            {isGeocoding ? "…" : "Search"}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full h-[350px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        {!markerPos && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-400 text-[11px] flex-col gap-1 pointer-events-none">
            <MapPin size={20} className="text-slate-300" />
            <span>Type a location and click Search</span>
          </div>
        )}
        <LoadScript googleMapsApiKey={MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={mapShown ? 14 : 7}
            onClick={handleMapClick}
            onLoad={(map) => { mapRef.current = map; }}
            options={{ disableDefaultUI: true, zoomControl: true }}
          >
            {markerPos && (
              <Marker position={markerPos} draggable onDragEnd={e => {
                if (!e.latLng) return;
                const lat = e.latLng.lat(); const lng = e.latLng.lng();
                setMarkerPos({ lat, lng }); handleReverseGeocode(lat, lng);
              }} />
            )}
          </GoogleMap>
        </LoadScript>
      </div>

      {formattedAddress && (
        <p className="text-[10px] text-[#402970] font-semibold bg-[#402970]/5 rounded-lg px-2.5 py-1.5 border border-[#402970]/10 truncate">
          📍 {formattedAddress}
        </p>
      )}

      {/* Type chips */}
      <div className="flex gap-1.5 pt-1">
        {ADDRESS_TYPES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setAddressType(value)}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex-1 justify-center ${
              addressType === value ? "bg-[#402970] border-[#402970] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-[#402970]/30"
            }`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>
      {addressType === "custom" && (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={customLabel}
            onChange={e => {
              setCustomLabel(e.target.value);
              // Clear error when user starts typing
              if (customLabelError) setCustomLabelError("");
            }}
            placeholder="e.g. Parents Place, Gym, Office 2"
            className={`w-full border rounded-lg px-3.5 py-2.5 text-xs outline-none focus:ring-2 bg-white font-medium transition-colors ${
              customLabelError
                ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-[#402970]/40 focus:ring-[#402970]/10"
            }`}
          />
          {customLabelError && (
            <p className="text-[10px] text-red-500 font-semibold leading-snug">{customLabelError}</p>
          )}
        </div>
      )}

      {/* City Dropdown */}
      <div className="flex flex-col gap-1.5 text-left relative" ref={suggestionsRef}>
        <label className="text-[10px] font-bold text-slate-700">City</label>
        <input
          type="text"
          value={city}
          onChange={e => handleCityChange(e.target.value)}
          onBlur={() => {
            setTimeout(() => {
              setCity(prev => {
                if (prev && !KAPRUKA_CITIES_SET.has(prev)) return "";
                return prev;
              });
            }, 150);
          }}
          placeholder="Select or search delivery city"
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white font-medium"
        />
        {showSuggestions && citySuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {citySuggestions.map((sug) => (
              <button
                key={sug.name}
                type="button"
                onClick={() => handleSelectSuggestion(sug.name)}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 font-semibold hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
              >
                {sug.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recipient Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-bold text-slate-700">Recipient Name</label>
          <input
            type="text"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            placeholder="e.g. John Doe"
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white"
          />
        </div>
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-bold text-slate-700">Contact Number</label>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-[10px] font-bold text-slate-700 shrink-0 select-none">
              🇱🇰 +94
            </div>
            <input
              type="tel"
              value={recipientPhone}
              onChange={e => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="e.g. 71 234 5678"
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white font-medium"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-200 mt-2">
        <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center gap-1">
          <X size={12} /> Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || !addressText.trim() || !city.trim() || recipientPhone.length !== 9 || !KAPRUKA_CITIES_SET.has(city) || (addressType === "custom" && (customLabel.trim() === "" || customLabel.trim().toLowerCase() === "home" || customLabel.trim().toLowerCase() === "work"))}
          className="flex-1 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
        >
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
interface AddressManagerProps {
  addresses: UserAddress[];
  /** Called with the full updated address array after any add/edit/delete/default change */
  onSave: (updated: UserAddress[]) => void;
  /** When provided (order flow mode), shows a "Deliver Here" button on each card */
  onSelect?: (address: UserAddress) => void;
  isSaving?: boolean;
}

export default function AddressManager({ addresses, onSave, onSelect, isSaving = false }: AddressManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSetDefault = (id: string) => {
    const updated = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    onSave(updated);
  };

  const handleDelete = (id: string) => {
    const updated = addresses.filter(a => a.id !== id);
    // If deleted was default, make first one default
    if (updated.length > 0 && !updated.some(a => a.isDefault)) {
      updated[0].isDefault = true;
    }
    onSave(updated);
    setConfirmDeleteId(null);
  };

  const handleSaveNew = (addr: UserAddress) => {
    // First address is always default
    const isFirst = addresses.length === 0;
    const updated = [...addresses, { ...addr, isDefault: isFirst }];
    onSave(updated);
    setShowAddForm(false);
  };

  const handleSaveEdit = (addr: UserAddress) => {
    const updated = addresses.map(a => a.id === addr.id ? addr : a);
    onSave(updated);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {addresses.length === 0 && !showAddForm && (
        <div className="text-center py-6 text-slate-400 text-xs">
          <MapPin size={28} className="mx-auto mb-2 text-slate-200" />
          No saved addresses yet.
        </div>
      )}

      {addresses.map(addr => (
        <div key={addr.id} className={`border rounded-xl p-3.5 flex flex-col gap-2.5 bg-white transition-all ${addr.isDefault ? "border-[#402970]/25 bg-[#402970]/[0.02]" : "border-slate-200"}`}>
          {editingId === addr.id ? (
            <AddressForm
              initial={addr}
              onSave={handleSaveEdit}
              onCancel={() => setEditingId(null)}
              isSaving={isSaving}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${addr.isDefault ? "bg-[#402970]/10 text-[#402970]" : "bg-slate-100 text-slate-500"}`}>
                    {typeIcon(addr.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-700">{addr.label}</span>
                      {addr.isDefault && (
                        <span className="text-[9px] font-bold bg-[#402970]/10 text-[#402970] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Star size={8} fill="currentColor" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {addr.formattedAddress || addr.addressLine}
                      {addr.city ? ` (${addr.city})` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">{addr.recipientName} · {addr.phone}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      title="Set as default"
                      className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                    >
                      <Star size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(addr.id)}
                    className="p-1.5 text-slate-300 hover:text-[#402970] hover:bg-[#402970]/5 rounded-lg transition-all cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(addr.id)}
                    className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Delete confirm */}
              {confirmDeleteId === addr.id && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
                  <span className="text-red-600 font-semibold flex-1">Delete this address?</span>
                  <button onClick={() => handleDelete(addr.id)} className="text-red-600 font-extrabold hover:text-red-700 cursor-pointer">Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-slate-400 font-semibold hover:text-slate-600 cursor-pointer">Cancel</button>
                </div>
              )}

              {/* Deliver Here button (order flow mode) */}
              {onSelect && (
                <button
                  onClick={() => onSelect(addr)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#402970] hover:bg-[#33205a] text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer mt-1"
                >
                  Deliver Here <ChevronRight size={13} />
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      {showAddForm ? (
        <AddressForm
          onSave={handleSaveNew}
          onCancel={() => setShowAddForm(false)}
          isSaving={isSaving}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-[#402970]/40 text-slate-500 hover:text-[#402970] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer hover:bg-[#402970]/5"
        >
          <Plus size={13} /> Add New Address
        </button>
      )}
    </div>
  );
}
