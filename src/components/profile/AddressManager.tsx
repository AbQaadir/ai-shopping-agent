"use client";

import React, { useState, useRef, useEffect } from "react";
import { Home, Briefcase, Tag, MapPin, Star, Pencil, Trash2, CheckCircle2, ChevronRight, Loader2, Plus, X } from "lucide-react";
import type { UserAddress } from "@/types/sourcing";

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

// ── Shared Maps script loader ──────────────────────────────────────
function loadMapsScript(apiKey: string, onReady: () => void) {
  if ((window as any).google?.maps) { onReady(); return; }
  const scriptId = "google-maps-script";
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  if ((script as any)._mapsLoaded) { onReady(); return; }
  const handler = () => { (script as any)._mapsLoaded = true; onReady(); };
  script.addEventListener("load", handler);
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
  const [formattedAddress, setFormattedAddress] = useState(initial?.formattedAddress || "");
  const [city, setCity] = useState(initial?.city || "");
  const [markerLatLng, setMarkerLatLng] = useState<{ lat: number; lng: number } | null>(
    initial?.lat ? { lat: initial.lat, lng: initial.lng! } : null
  );
  const [addressType, setAddressType] = useState<"home" | "work" | "custom">(initial?.type || "home");
  const [customLabel, setCustomLabel] = useState(initial?.type === "custom" ? initial.label || "" : "");
  const [recipientName, setRecipientName] = useState(initial?.recipientName || "");
  const [recipientPhone, setRecipientPhone] = useState(initial?.phone || "");
  const [mapReady, setMapReady] = useState(false);

  // Imperative refs
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const isAdvancedMarkerRef = useRef(false);
  const initialisedRef = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────
  const extractCity = (components: any[]) => {
    const c = components?.find(
      (c: any) => c.types.includes("locality") || c.types.includes("administrative_area_level_2")
    );
    return c?.long_name || "";
  };

  const updateMarkerAndReverse = (latLng: any) => {
    if (!latLng) return;
    const g = (window as any).google;
    const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
    const pos = { lat, lng };
    setMarkerLatLng(pos);

    if (markerInstanceRef.current) {
      if (isAdvancedMarkerRef.current) {
        markerInstanceRef.current.position = new g.maps.LatLng(lat, lng);
      } else {
        markerInstanceRef.current.setPosition(pos);
      }
    }

    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: pos }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          setFormattedAddress(results[0].formatted_address);
          setCity(extractCity(results[0].address_components));
        }
      });
    }
  };

  // ── Init map ─────────────────────────────────────────────────
  const initMap = async () => {
    if (!mapDivRef.current || initialisedRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;
    initialisedRef.current = true;

    try {
      let MapClass: any, GeocoderClass: any, MarkerClass: any;
      let isAdv = false;

      if (g.maps.importLibrary) {
        const [mapsLib, geoLib, markerLib] = await Promise.all([
          g.maps.importLibrary("maps"),
          g.maps.importLibrary("geocoding"),
          g.maps.importLibrary("marker"),
        ]);
        MapClass = mapsLib.Map;
        GeocoderClass = geoLib.Geocoder;
        if (markerLib.AdvancedMarkerElement) { MarkerClass = markerLib.AdvancedMarkerElement; isAdv = true; }
        else MarkerClass = markerLib.Marker || g.maps.Marker;
      } else {
        MapClass = g.maps.Map;
        GeocoderClass = g.maps.Geocoder;
        MarkerClass = g.maps.Marker;
        if (g.maps.marker?.AdvancedMarkerElement) { MarkerClass = g.maps.marker.AdvancedMarkerElement; isAdv = true; }
      }
      isAdvancedMarkerRef.current = isAdv;

      const initCenter = initial?.lat ? { lat: initial.lat, lng: initial.lng! } : SRI_LANKA_CENTER;
      const initZoom = initial?.lat ? 14 : 7;

      const map = new MapClass(mapDivRef.current, {
        center: initCenter,
        zoom: initZoom,
        mapId: "kapruka_addr_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        clickableIcons: false,
      });
      mapInstanceRef.current = map;
      geocoderRef.current = new GeocoderClass();

      // Marker — visible immediately if editing an existing address
      const markerEl = document.createElement("div");
      markerEl.style.cssText = `width:22px;height:22px;background:#402970;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:grab;display:${initial?.lat ? "block" : "none"}`;

      let marker: any;
      if (isAdv) {
        marker = new MarkerClass({ position: initCenter, map, content: markerEl, gmpDraggable: true });
        marker.addListener("gmp-dragend", () => updateMarkerAndReverse(marker.position));
        marker.addListener("dragend", (e: any) => updateMarkerAndReverse(e.latLng || marker.position));
      } else {
        marker = new MarkerClass({
          position: initCenter, map, draggable: true,
          visible: !!initial?.lat,
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png" },
        });
        marker.addListener("dragend", (e: any) => updateMarkerAndReverse(e.latLng));
      }
      markerInstanceRef.current = marker;

      map.addListener("click", (e: any) => {
        updateMarkerAndReverse(e.latLng);
        // Show marker on first click
        if (isAdv && marker.content) (marker.content as HTMLElement).style.display = "block";
        else if (!isAdv) marker.setVisible(true);
      });

      setMapReady(true);
    } catch (err) {
      console.error("Maps init error:", err);
    }
  };

  // ── Load script on mount ──────────────────────────────────────
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    loadMapsScript(MAPS_API_KEY, () => setTimeout(initMap, 50));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Find button ───────────────────────────────────────────────
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

          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo(pos);
            mapInstanceRef.current.setZoom(14);
          }

          const marker = markerInstanceRef.current;
          if (marker) {
            const g = (window as any).google;
            if (isAdvancedMarkerRef.current) {
              marker.position = new g.maps.LatLng(pos.lat, pos.lng);
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

  const handleSubmit = () => {
    const addr: UserAddress = {
      id: initial?.id || crypto.randomUUID(),
      type: addressType,
      label: addressType === "custom" ? (customLabel || "Custom") : (addressType === "home" ? "Home" : "Work"),
      recipientName,
      phone: recipientPhone,
      addressLine: addressText,
      city,
      lat: markerLatLng?.lat,
      lng: markerLatLng?.lng,
      formattedAddress: formattedAddress || addressText,
      isDefault: initial?.isDefault ?? false,
    };
    onSave(addr);
  };
  return (
    <div className="flex flex-col gap-4">
      {/* Address input + Find */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Search Delivery Location</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={addressText}
            onChange={e => setAddressText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGeocode()}
            placeholder="Enter street address, city, or area..."
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white font-medium"
          />
          <button
            onClick={handleGeocode}
            disabled={isGeocoding || !addressText.trim() || !mapReady}
            className="flex items-center gap-1.5 bg-[#402970] hover:bg-[#33205a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer shadow-sm shrink-0"
          >
            {isGeocoding ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
            <span>{isGeocoding ? "Searching…" : "Search"}</span>
          </button>
        </div>
      </div>

      {/* Map — always in DOM, imperative init */}
      <div className="relative w-full h-[350px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        {!markerLatLng && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-400 text-[11px] flex-col gap-1 pointer-events-none">
            <MapPin size={20} className="text-slate-300" />
            <span>Type a location and click Search</span>
          </div>
        )}
        <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
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
        <input
          type="text"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          placeholder="e.g. Girlfriend's Place"
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs outline-none focus:border-[#402970]/40 bg-white font-medium"
        />
      )}

      {/* Recipient Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Recipient Name</label>
          <input
            type="text"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs outline-none focus:border-[#402970]/40 focus:ring-2 focus:ring-[#402970]/10 bg-white font-medium"
          />
        </div>
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Contact Number</label>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-[10px] font-bold text-slate-700 shrink-0 select-none">
              🇱🇰 +94
            </div>
            <input
              type="tel"
              value={recipientPhone}
              onChange={e => setRecipientPhone(e.target.value)}
              placeholder="77 123 4567"
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
          disabled={isSaving || !addressText.trim()}
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
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{addr.formattedAddress || addr.addressLine}</p>
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
