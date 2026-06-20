"use client";

import type { OrderFlowStepData } from "@/types/sourcing";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Truck,
  User,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSourcing } from "@/context/SourcingContext";
import { cleanProductTitle } from "@/lib/product";

interface OrderStepBubbleProps {
  step: OrderFlowStepData;
  onAction: (userMessage: string) => void;
  isActive?: boolean;
}

// ── Quantity Ask Variant ───────────────────────────────────────────────────
function QtyAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const { handleUpdateCart } = useSourcing();
  const [qty, setQty] = useState(1);
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const maxQty = step.stockQty ?? 50;
  const hasError = !!step.errorMessage;

  const handleConfirm = () => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (isCart) {
      onAction("Confirm quantities");
    } else {
      onAction(`I'd like to order ${qty} unit${qty > 1 ? "s" : ""}`);
    }
  };

  const isCart = step.cartItems && step.cartItems.length > 0;

  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    if (!isActive) return;
    const updated = (step.cartItems || []).map((item) => {
      const matchId = item.id || item.name;
      if (matchId === itemId) {
        return { ...item, quantity: Math.max(1, currentQty + delta) };
      }
      return item;
    });
    handleUpdateCart(updated);
  };

  const handleRemove = (itemId: string) => {
    if (!isActive) return;
    const updated = (step.cartItems || []).filter((item) => (item.id || item.name) !== itemId);
    handleUpdateCart(updated);
  };

  if (isCart) {
    const totalItems = step.cartItems!.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = step.cartItems!.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
      <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
          <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
            <Package size={16} />
          </span>
          <h4 className="text-sm font-bold text-slate-800">Confirm Quantities</h4>
        </div>

        {/* Cart items list */}
        <div className="space-y-3.5 mb-5 pr-1">
          {step.cartItems!.map((item, idx) => (
            <div
              key={item.id || item.name || idx}
              className="flex items-center justify-between gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50/80 transition-colors animate-fadeIn"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Package size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 truncate max-w-[180px] sm:max-w-[280px]">
                    {cleanProductTitle(item.name)}
                  </h5>
                  <p className="text-sm font-extrabold text-[#402970] mt-1">
                    Rs. {item.price.toLocaleString()} each
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 shrink-0">
                {isActive ? (
                  <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg p-0.5 shadow-xs">
                    <button
                      onClick={() => handleQtyChange(item.id || item.name, item.quantity, -1)}
                      disabled={item.quantity <= 1 || submitted}
                      className="p-1 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="text-xs font-extrabold text-slate-800 w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item.id || item.name, item.quantity, 1)}
                      disabled={submitted}
                      className="p-1 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Qty: {item.quantity}
                  </span>
                )}

                {isActive && (
                  <button
                    onClick={() => handleRemove(item.id || item.name)}
                    disabled={submitted}
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer border-none bg-transparent"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Grand Subtotal */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 mb-5">
          <span className="text-xs font-bold text-slate-600">Total subtotal ({totalItems} items)</span>
          <span className="text-base font-black text-[#402970]">
            Rs. {totalPrice.toLocaleString()}
          </span>
        </div>

        {/* Action Button */}
        {submitted || !isActive ? (
          <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none">
            <CheckCircle size={13} className="text-[#402970]" /> {submitted ? "Confirming quantities..." : "Quantities Confirmed"}
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={step.cartItems!.length === 0}
            className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer outline-none"
          >
            Confirm Quantities <ChevronRight size={13} />
          </button>
        )}
      </div>
    );
  }

  const unitPrice = step.product?.price || 0;
  const totalPrice = unitPrice * qty;

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <Package size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-800">Confirm Quantity</h4>
      </div>

      {/* Product Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50/60 border border-slate-100/80 rounded-2xl mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {step.product?.imageUrl ? (
            <img
              src={step.product.imageUrl}
              alt={step.product.name || ""}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Package size={22} className="text-slate-400" />
            </div>
          )}
          <div className="min-w-0">
            <h5 className="text-xs font-bold text-slate-800 truncate max-w-[180px] sm:max-w-[280px]">
              {cleanProductTitle(step.product?.name || step.product?.title)}
            </h5>
            {unitPrice > 0 && (
              <p className="text-sm font-extrabold text-[#402970] mt-1">
                Rs. {unitPrice.toLocaleString()} / unit
              </p>
            )}
          </div>
        </div>

        {/* Stock Badge */}
        <div
          className={`self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${
            hasError
              ? "bg-amber-50 border-amber-100 text-amber-600"
              : "bg-emerald-50 border-emerald-100 text-emerald-600"
          }`}
        >
          {hasError ? <AlertCircle size={12} className="shrink-0" /> : <CheckCircle size={12} className="shrink-0" />}
          {hasError ? `Only ${maxQty} left` : `In Stock (Up to ${maxQty} units)`}
        </div>
      </div>

      {/* Selector and Subtotal Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 mb-5">
        {/* Quantity buttons */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">Quantity</span>
          <div className="flex items-center gap-2 border border-slate-200 bg-slate-50/50 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1 || submitted || !isActive}
              className="p-2 hover:bg-white rounded-lg text-slate-500 disabled:opacity-30 transition-all cursor-pointer hover:shadow-xs active:scale-95"
            >
              <Minus size={12} />
            </button>
            <span className="text-xs font-extrabold text-slate-800 w-8 text-center">{qty}</span>
            <button
              onClick={() => setQty(Math.min(maxQty, qty + 1))}
              disabled={qty >= maxQty || submitted || !isActive}
              className="p-2 hover:bg-white rounded-lg text-slate-500 disabled:opacity-30 transition-all cursor-pointer hover:shadow-xs active:scale-95"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Total Cost */}
        {unitPrice > 0 && (
          <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-2 sm:gap-0.5 border-t sm:border-0 border-slate-100 pt-3 sm:pt-0">
            <span className="text-xs font-bold text-slate-600">Subtotal (LKR)</span>
            <span className="text-base font-black text-[#402970]">
              Rs. {totalPrice.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Action CTA */}
      {submitted || !isActive ? (
        <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none">
          <CheckCircle size={13} className="text-[#402970]" /> {submitted ? "Confirming quantity..." : "Quantity Confirmed"}
        </div>
      ) : (
        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer"
        >
          Confirm {qty} Unit{qty > 1 ? "s" : ""} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

// ── Delivery Ask Variant ───────────────────────────────────────────────────
function DeliveryAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const addrs = step.savedAddresses || [];
  const hasAddrs = addrs.length > 0;

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    if (!isActive && step.confirmedAddress) {
      const match = addrs.find(a => 
        (a.addressLine || (a as any).address) === step.confirmedAddress?.address && 
        a.city === step.confirmedAddress?.city
      );
      if (match) return match.id;
      return "new";
    }
    return null;
  });

  const handleSaved = (id: string) => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSelectedAddressId(id);
    setSubmitted(true);
    onAction(`Use address: ${id}`);
  };

  const handleNew = () => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSelectedAddressId('new');
    setSubmitted(true);
    onAction("I want to use a new delivery address");
  };

  const getLabelIcon = (label: string) => {
    const lower = (label || "").toLowerCase();
    if (lower === "home") return "🏠";
    if (lower === "work") return "💼";
    return "🏷️";
  };

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <MapPin size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-800">Delivery Details</h4>
      </div>

      {/* Address Details Container */}
      <div className="mb-5 flex flex-col gap-3">
        {hasAddrs ? (
          addrs.map((addr) => {
            const isSelected = selectedAddressId === addr.id;
            const isInactiveState = !isActive && !isSelected && selectedAddressId !== null;

            if (isInactiveState) return null; // Hide unselected options when inactive

            return (
              <div 
                key={addr.id}
                onClick={() => isActive && !submitted && handleSaved(addr.id)}
                className={`p-4 rounded-2xl flex flex-col gap-3 transition-all ${
                  isActive && !submitted 
                    ? "bg-slate-50/60 border border-slate-200/80 hover:border-[#402970] hover:bg-[#402970]/5 cursor-pointer active:scale-[0.98]" 
                    : isSelected
                      ? "bg-[#402970]/5 border border-[#402970]/20"
                      : "bg-slate-50/60 border border-slate-100/80"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px]">{getLabelIcon(addr.label || addr.type)}</span>
                    <span className="text-[13px] font-bold text-slate-800 capitalize">{addr.label || addr.type}</span>
                    {addr.isDefault && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">★ Default</span>
                    )}
                  </div>
                  {(!isActive || submitted) && isSelected && (
                    <CheckCircle size={14} className="text-[#402970]" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-[#402970] shrink-0" />
                    <span className="text-[13px] font-bold text-slate-800">{addr.recipientName || (addr as any).name || "Customer"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span className="text-[13px] font-bold text-slate-800">{addr.phone}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-0.5">
                  <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[13px] font-bold text-slate-800 leading-relaxed truncate-line-clamp">
                    {addr.addressLine || (addr as any).address}, {addr.city}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-5 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <MapPin size={22} className="text-slate-300" />
            <p className="text-[11px] text-slate-500 font-medium max-w-xs leading-normal">
              No saved address found on file. Pin your delivery location on the map to proceed.
            </p>
          </div>
        )}
      </div>

      {/* Action Area */}
      {submitted || !isActive ? (
        <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none mt-2">
          <CheckCircle size={13} className="text-[#402970]" />{" "}
          {selectedAddressId === "new" ? "New Address Selected" : "Saved Address Confirmed"}
        </div>
      ) : (
        <div className="flex justify-center mt-2">
          <button
            onClick={handleNew}
            className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Navigation size={13} className="text-slate-500" />
            {hasAddrs ? "＋ Use a new address" : "Pin delivery location"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Address Form Variant ───────────────────────────────────────────────
function NewAddressFormBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmedAddress, setConfirmedAddress] = useState("");
  const [confirmedCity, setConfirmedCity] = useState("");
  
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Map Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const initMap = async () => {
    if (typeof window === "undefined" || !(window as any).google || !mapRef.current) return;
    if (mapInstanceRef.current) return;
    
    const google = (window as any).google;
    const center = { lat: 6.9271, lng: 79.8612 }; // Default Colombo
    
    try {
      let MapClass: any;
      let GeocoderClass: any;
      let MarkerClass: any;
      let isAdvanced = false;

      if (google.maps.importLibrary) {
        const [mapsLib, geocodingLib, markerLib] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("geocoding"),
          google.maps.importLibrary("marker"),
        ]);
        MapClass = mapsLib.Map;
        GeocoderClass = geocodingLib.Geocoder;
        if (markerLib.AdvancedMarkerElement) {
          MarkerClass = markerLib.AdvancedMarkerElement;
          isAdvanced = true;
        } else {
          MarkerClass = markerLib.Marker || google.maps.Marker;
        }
      } else {
        MapClass = google.maps.Map;
        GeocoderClass = google.maps.Geocoder;
        MarkerClass = google.maps.Marker;
      }

      const map = new MapClass(mapRef.current, {
        center,
        zoom: 13,
        mapId: "kapruka_new_address_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;

      let marker: any;
      if (isAdvanced) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:24px;height:24px;background:#402970;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:grab";
        marker = new MarkerClass({ position: center, map, content: el, gmpDraggable: isActive });
      } else {
        marker = new MarkerClass({
          position: center,
          map,
          draggable: isActive,
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png" },
        });
      }
      markerInstanceRef.current = marker;

      const geocoder = new GeocoderClass();
      geocoderRef.current = geocoder;

      const updateAddr = (latLng: any) => {
        if (!latLng) return;
        const latLngObj = (latLng instanceof google.maps.LatLng)
          ? latLng
          : new google.maps.LatLng(
              typeof latLng.lat === "function" ? latLng.lat() : latLng.lat,
              typeof latLng.lng === "function" ? latLng.lng() : latLng.lng
            );

        if (markerInstanceRef.current) {
          if (isAdvanced) {
            markerInstanceRef.current.position = latLngObj;
          } else {
            markerInstanceRef.current.setPosition(latLngObj);
          }
        }

        geocoder.geocode({ location: latLngObj }, (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            setConfirmedAddress(results[0].formatted_address);
            const comps = results[0].address_components;
            const cityComp = comps.find(
              (c: any) =>
                c.types.includes("locality") ||
                c.types.includes("sublocality_level_1") ||
                c.types.includes("administrative_area_level_3")
            );
            setConfirmedCity(cityComp?.long_name || "Colombo");
          }
        });
      };

      if (isActive) {
        map.addListener("click", (e: any) => updateAddr(e.latLng));
        if (isAdvanced) {
          marker.addListener("gmp-dragend", () => updateAddr(marker.position));
          marker.addListener("dragend", (e: any) => updateAddr(e.latLng || marker.position));
        } else {
          marker.addListener("dragend", (e: any) => updateAddr(e.latLng));
        }
      }
    } catch (err) {
      console.error("Maps init error:", err);
      setMapsLoadFailed(true);
    }
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapsLoadFailed(true);
      return;
    }

    if ((window as any).google?.maps) {
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    if ((script as any)._mapsLoaded) {
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
      return;
    }

    const timeout = setTimeout(() => setMapsLoadFailed(true), 8000);

    const onLoad = () => {
      clearTimeout(timeout);
      (script as any)._mapsLoaded = true;
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
    };
    const onError = () => {
      clearTimeout(timeout);
      setMapsLoadFailed(true);
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      clearTimeout(timeout);
    };
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim() || !geocoderRef.current || !mapInstanceRef.current) return;
    geocoderRef.current.geocode({ address: searchQuery + ", Sri Lanka" }, (results: any, status: any) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        mapInstanceRef.current.setCenter(loc);
        mapInstanceRef.current.setZoom(16);
        
        if (markerInstanceRef.current) {
          if (markerInstanceRef.current.position) markerInstanceRef.current.position = loc;
          else markerInstanceRef.current.setPosition(loc);
        }

        setConfirmedAddress(results[0].formatted_address);
        const comps = results[0].address_components;
        const cityComp = comps.find(
          (c: any) =>
            c.types.includes("locality") ||
            c.types.includes("sublocality_level_1") ||
            c.types.includes("administrative_area_level_3")
        );
        setConfirmedCity(cityComp?.long_name || "Colombo");
      }
    });
  };

  const handleConfirmForm = () => {
    if (submittedRef.current || !isActive) return;
    if (!name.trim() || !phone.trim() || (!confirmedAddress.trim() && !mapsLoadFailed)) return;
    
    submittedRef.current = true;
    setSubmitted(true);
    
    const finalAddr = confirmedAddress.trim() || "Unknown Address";
    const finalCity = confirmedCity.trim() || "Colombo";
    
    // new address confirmed: Name|Phone|Address|City
    onAction(`New address confirmed: ${name.trim()}|${phone.trim()}|${finalAddr}|${finalCity}`);
  };

  const canConfirm = name.trim().length > 0 && phone.trim().length === 9 && (mapsLoadFailed || confirmedAddress.length > 0);

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <MapPin size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-800">New Delivery Address</h4>
      </div>

      <div className="flex flex-col gap-4">
        {/* Recipient Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recipient Name</label>
            <input
              type="text"
              placeholder="e.g. Kamal Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitted || !isActive}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-colors placeholder:text-slate-400 bg-slate-50/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phone Number</label>
            <div className="flex bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#402970] focus-within:ring-1 focus-within:ring-[#402970] transition-colors">
              <span className="flex items-center px-3 text-xs font-bold text-slate-500 bg-slate-100/50 border-r border-slate-200">
                +94
              </span>
              <input
                type="tel"
                placeholder="77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                disabled={submitted || !isActive}
                className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Location Search */}
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Search Rough Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Nugegoda Supermarket"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={submitted || !isActive}
              className="flex-1 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-colors placeholder:text-slate-400 bg-slate-50/50"
            />
            <button
              onClick={handleSearch}
              disabled={submitted || !isActive || !searchQuery.trim()}
              className="px-4 py-2.5 bg-[#402970]/10 text-[#402970] rounded-xl text-xs font-bold hover:bg-[#402970]/20 transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {/* Map View */}
        {mapsLoadFailed ? (
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Full Address (Manual Entry)</label>
            <textarea
              placeholder="Enter full address manually since maps failed to load"
              value={confirmedAddress}
              onChange={(e) => setConfirmedAddress(e.target.value)}
              disabled={submitted || !isActive}
              className="w-full h-24 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-colors placeholder:text-slate-400 bg-slate-50/50 resize-none"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-[11px] text-slate-500 font-medium">
              Drag the <strong className="text-[#402970]">purple pin</strong> to your exact door or tap anywhere on the map.
            </p>
            <div className="w-full h-[250px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative shadow-inner">
              {useGoogleMaps ? (
                <div ref={mapRef} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#402970]" />
                  <span className="text-xs font-semibold">Loading map view...</span>
                </div>
              )}
            </div>
            {confirmedAddress && (
              <div className="flex items-start gap-2.5 p-3.5 bg-[#402970]/5 border border-[#402970]/10 rounded-2xl mt-1">
                <MapPin size={14} className="text-[#402970] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Pinned Address</p>
                  <p className="text-[11px] text-slate-700 font-bold leading-relaxed mt-0.5">{confirmedAddress}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action CTA */}
        {submitted || !isActive ? (
          <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none mt-2">
            <CheckCircle size={13} className="text-[#402970]" /> Address Confirmed
          </div>
        ) : (
          <button
            onClick={handleConfirmForm}
            disabled={!canConfirm}
            className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={13} /> Confirm Delivery Address
          </button>
        )}
      </div>
    </div>
  );
}

// ── Map Open Variant ───────────────────────────────────────────────────────
function MapOpenBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState("");
  const [confirmedCity, setConfirmedCity] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const geo = step.geocodedLocation;

  const initMap = async () => {
    if (typeof window === "undefined" || !(window as any).google || !mapRef.current || !geo) return;
    if (mapInstanceRef.current) return;
    const google = (window as any).google;
    let center = { lat: geo.lat, lng: geo.lng };
    let initialAddress = geo.formattedAddress;
    let initialCity = "Colombo";

    // Detect if we fell back to Colombo coordinates because server geocoding failed/is restricted
    const isFallback = geo.lat === 6.9271 && geo.lng === 79.8612 && geo.label !== "Colombo" && geo.label !== "Colombo, Sri Lanka";

    try {
      let MapClass: any;
      let GeocoderClass: any;
      let MarkerClass: any;
      let isAdvanced = false;

      if (google.maps.importLibrary) {
        const [mapsLib, geocodingLib, markerLib] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("geocoding"),
          google.maps.importLibrary("marker"),
        ]);
        MapClass = mapsLib.Map;
        GeocoderClass = geocodingLib.Geocoder;
        if (markerLib.AdvancedMarkerElement) {
          MarkerClass = markerLib.AdvancedMarkerElement;
          isAdvanced = true;
        } else {
          MarkerClass = markerLib.Marker || google.maps.Marker;
        }
      } else {
        MapClass = google.maps.Map;
        GeocoderClass = google.maps.Geocoder;
        MarkerClass = google.maps.Marker;
        if (google.maps.marker && (google.maps.marker as any).AdvancedMarkerElement) {
          MarkerClass = (google.maps.marker as any).AdvancedMarkerElement;
          isAdvanced = true;
        }
      }

      if (isFallback) {
        // Run forward geocoding client-side using the browser context to bypass HTTP referrer restrictions
        const geocoder = new google.maps.Geocoder();
        try {
          const results = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ address: geo.formattedAddress + ", Sri Lanka" }, (res: any, status: any) => {
              if (status === "OK" && res && res.length > 0) {
                resolve(res);
              } else {
                reject(status);
              }
            });
          });

          const loc = results[0].geometry.location;
          center = {
            lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
            lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
          };
          initialAddress = results[0].formatted_address;
          const comps = results[0].address_components || [];
          const cityComp = comps.find(
            (c: any) =>
              c.types.includes("locality") ||
              c.types.includes("sublocality_level_1") ||
              c.types.includes("administrative_area_level_3")
          );
          initialCity = cityComp?.long_name || "Colombo";
        } catch (geocodeErr) {
          console.error("Client-side forward geocoding failed, using default coordinates:", geocodeErr);
        }
      }

      const map = new MapClass(mapRef.current, {
        center,
        zoom: 16,
        mapId: "kapruka_order_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;

      let marker: any;
      if (isAdvanced) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:24px;height:24px;background:#402970;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:grab";
        marker = new MarkerClass({ position: center, map, content: el, gmpDraggable: isActive });
      } else {
        marker = new MarkerClass({
          position: center,
          map,
          draggable: isActive,
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png" },
        });
      }
      markerInstanceRef.current = marker;

      const geocoder = new GeocoderClass();
      const updateAddr = (latLng: any) => {
        if (!latLng) return;
        const google = (window as any).google;
        const latLngObj = (latLng instanceof google.maps.LatLng)
          ? latLng
          : new google.maps.LatLng(
              typeof latLng.lat === "function" ? latLng.lat() : latLng.lat,
              typeof latLng.lng === "function" ? latLng.lng() : latLng.lng
            );

        if (markerInstanceRef.current) {
          if (isAdvanced) {
            markerInstanceRef.current.position = latLngObj;
          } else {
            markerInstanceRef.current.setPosition(latLngObj);
          }
        }

        geocoder.geocode({ location: latLngObj }, (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            setConfirmedAddress(results[0].formatted_address);
            const comps = results[0].address_components;
            const cityComp = comps.find(
              (c: any) =>
                c.types.includes("locality") ||
                c.types.includes("sublocality_level_1") ||
                c.types.includes("administrative_area_level_3")
            );
            setConfirmedCity(cityComp?.long_name || "Colombo");
          }
        });
      };

      setConfirmedAddress(initialAddress);
      setConfirmedCity(isFallback ? initialCity : (geo.label || "Colombo"));

      if (isActive) {
        map.addListener("click", (e: any) => updateAddr(e.latLng));
        if (isAdvanced) {
          marker.addListener("gmp-dragend", () => updateAddr(marker.position));
          marker.addListener("dragend", (e: any) => updateAddr(e.latLng || marker.position));
        } else {
          marker.addListener("dragend", (e: any) => updateAddr(e.latLng));
        }
      }
    } catch (err) {
      console.error("Maps init error:", err);
      setMapsLoadFailed(true);
    }
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !geo) {
      setMapsLoadFailed(true);
      return;
    }

    if ((window as any).google?.maps) {
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    if ((script as any)._mapsLoaded) {
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
      return;
    }

    const timeout = setTimeout(() => setMapsLoadFailed(true), 8000);

    const onLoad = () => {
      clearTimeout(timeout);
      (script as any)._mapsLoaded = true;
      setUseGoogleMaps(true);
      setTimeout(initMap, 50);
    };
    const onError = () => {
      clearTimeout(timeout);
      setMapsLoadFailed(true);
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      clearTimeout(timeout);
    };
  }, [geo?.lat, geo?.lng, geo?.label, geo?.formattedAddress]);

  const handleConfirmLocation = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (mapsLoadFailed) {
      const addr = manualAddress.trim() || geo?.formattedAddress || "Unknown address";
      const city = manualCity.trim() || geo?.label || "Colombo";
      onAction(`Confirm location: ${addr}, ${city}`);
    } else {
      const addr = confirmedAddress;
      const city = confirmedCity || geo?.label || "Colombo";
      onAction(`Confirm location: ${addr}, ${city}`);
    }
  };

  const canConfirm = mapsLoadFailed ? manualAddress.trim().length > 3 : !!confirmedAddress;

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <MapPin size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-800">
          {mapsLoadFailed ? "Enter Delivery Address" : "Pin Location"}
        </h4>
      </div>

      <div className="flex flex-col gap-4">
        {mapsLoadFailed ? (
          /* Text input fallback */
          <>
            <p className="text-[11px] text-slate-500 font-medium">
              We couldn't load Google Maps. Please type your delivery address details manually below:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Street / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Galle Road, near Temple"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  disabled={submitted || !isActive}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-colors placeholder:text-slate-400 bg-slate-50/50"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">City</label>
                <input
                  type="text"
                  placeholder="e.g. Colombo 3"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  disabled={submitted || !isActive}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-colors placeholder:text-slate-400 bg-slate-50/50"
                />
              </div>
            </div>
          </>
        ) : (
          /* Wide and tall Map view */
          <>
            <p className="text-[11px] text-slate-500 font-medium">
              Drag the <strong className="text-[#402970]">purple pin</strong> to your exact door or tap anywhere on the map to locate.
            </p>
            <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative shadow-inner">
              {useGoogleMaps ? (
                <div ref={mapRef} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#402970]" />
                  <span className="text-xs font-semibold">Loading map view...</span>
                </div>
              )}
            </div>
            {confirmedAddress && (
              <div className="flex items-start gap-2.5 p-3.5 bg-[#402970]/5 border border-[#402970]/10 rounded-2xl">
                <MapPin size={14} className="text-[#402970] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Selected Address</p>
                  <p className="text-[11px] text-slate-700 font-bold leading-relaxed mt-0.5">{confirmedAddress}</p>
                </div>
              </div>
            )}
          </>
        )}

      {submitted || !isActive ? (
        <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none">
          <CheckCircle size={13} className="text-[#402970]" /> Location Confirmed
        </div>
      ) : (
        <button
          onClick={handleConfirmLocation}
          disabled={!canConfirm}
          className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
        >
          <CheckCircle size={13} /> Confirm this location
        </button>
      )}
      </div>
    </div>
  );
}

// ── Payment Ask Variant ────────────────────────────────────────────────────
function PaymentAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  
  const totalLKR = step.cartItems && step.cartItems.length > 0
    ? step.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : (step.product?.price || 0) * (step.confirmedQuantity || 1);

  const addr = step.confirmedAddress || step.savedAddress;

  const [selectedMethod, setSelectedMethod] = useState<'cod' | 'card' | null>(() => {
    if (!isActive) {
      return step.paymentMethod || null;
    }
    return null;
  });

  const handle = (method: "cod" | "card") => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSelectedMethod(method);
    setSubmitted(true);
    onAction(method === "cod" ? "I'll pay cash on delivery" : "I want to pay by card online");
  };

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <CreditCard size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-800">Order Review & Payment</h4>
      </div>

      <div className="flex flex-col gap-5">
        {/* Ordered Items Review Section */}
        <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex flex-col gap-4">
          <h5 className="text-xs font-bold text-slate-700">Order Items</h5>
          
          {step.cartItems && step.cartItems.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {step.cartItems.map((item, idx) => (
                <div key={item.id || item.name || idx} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <Package size={16} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-slate-800 truncate">{cleanProductTitle(item.name)}</h5>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Qty: {item.quantity} × Rs. {item.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#402970] shrink-0">
                    Rs. {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : step.product ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {step.product.imageUrl ? (
                  <img
                    src={step.product.imageUrl}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Package size={16} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-800 truncate">{cleanProductTitle(step.product.name || step.product.title)}</h5>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Qty: {step.confirmedQuantity || 1} × Rs. {(step.product.price || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#402970] shrink-0">
                Rs. {totalLKR.toLocaleString()}
              </span>
            </div>
          ) : null}

          {/* Subtotal Row */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-100/70 mt-1">
            <span className="text-xs font-bold text-slate-700">Order Subtotal</span>
            <span className="text-sm font-black text-[#402970]">Rs. {totalLKR.toLocaleString()}</span>
          </div>
        </div>

        {/* Delivery Details Section */}
        {addr && (
          <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3">
            <h5 className="text-xs font-bold text-slate-700">Delivery Location</h5>
            <div className="flex items-center gap-3 bg-white border border-slate-100/80 rounded-xl p-3 shadow-xs">
              <div className="p-2.5 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
                <MapPin size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-bold text-slate-800">{addr.name}</p>
                  {addr.phone && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-700 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md font-semibold">
                      <Phone size={10} className="text-[#402970]" />
                      <span>{addr.phone}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                  {addr.address}, {addr.city}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods Section */}
        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-bold text-slate-700">Choose Payment Method</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => !(submitted || !isActive) && handle("cod")}
              className={`flex flex-col justify-between p-5 border-2 rounded-2xl text-left transition-all duration-200 select-none h-36 ${
                submitted || !isActive
                  ? selectedMethod === "cod"
                    ? "border-[#402970]/20 bg-[#402970]/10 opacity-100"
                    : "border-slate-100 bg-white opacity-40"
                  : "border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 cursor-pointer active:scale-[0.98]"
              }`}
            >
              <div className={`w-10 h-10 border rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                (submitted || !isActive) && selectedMethod === "cod"
                  ? "bg-[#402970]/20 border-[#402970]/20"
                  : "bg-amber-50 border-amber-100"
              }`}>
                <Truck size={20} className={
                  (submitted || !isActive) && selectedMethod === "cod" ? "text-[#402970]" : "text-amber-600"
                } />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-slate-800">Cash on Delivery</p>
                  {(submitted || !isActive) && selectedMethod === "cod" && (
                    <CheckCircle size={14} className="text-[#402970]" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">
                  Pay in cash when our courier delivers the package
                </p>
              </div>
            </div>

            <div
              onClick={() => !(submitted || !isActive) && handle("card")}
              className={`flex flex-col justify-between p-5 border-2 rounded-2xl text-left transition-all duration-200 select-none h-36 ${
                submitted || !isActive
                  ? selectedMethod === "card"
                    ? "border-[#402970]/20 bg-[#402970]/10 opacity-100"
                    : "border-slate-100 bg-white opacity-40"
                  : "border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 cursor-pointer active:scale-[0.98]"
              }`}
            >
              <div className={`w-10 h-10 border rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                (submitted || !isActive) && selectedMethod === "card"
                  ? "bg-[#402970]/20 border-[#402970]/20"
                  : "bg-[#402970]/10 border-[#402970]/10"
              }`}>
                <CreditCard size={20} className="text-[#402970]" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-slate-800">Credit / Debit Card</p>
                  {(submitted || !isActive) && selectedMethod === "card" && (
                    <CheckCircle size={14} className="text-[#402970]" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">
                  Pay securely online using Kapruka checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirmed Variant ──────────────────────────────────────────────────────
function ConfirmedBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const addr = step.confirmedAddress;
  const totalLKR = step.cartItems && step.cartItems.length > 0
    ? step.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : (step.product?.price || 0) * (step.confirmedQuantity || 1);
  const orderFailed = !step.orderId && step.paymentMethod === "card" && !step.checkoutUrl;

  return (
    <div
      className={`w-full bg-white border rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4 ${
        orderFailed ? "border-rose-100" : "border-emerald-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span
          className={`p-2 rounded-xl shrink-0 ${
            orderFailed ? "bg-rose-50 text-rose-500 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          }`}
        >
          {orderFailed ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
        </span>
        <div>
          <h4
            className={`text-sm font-bold ${
              orderFailed ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {orderFailed ? "Order Failed" : "Order Confirmed 🎉"}
          </h4>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {orderFailed ? "Please check details and retry" : `Order Ref: ${step.orderId || "Pending"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {orderFailed ? (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              We encountered a connection issue while submitting your request to Kapruka order APIs.
            </p>
            {!isActive ? (
              <div className="w-full py-3 bg-[#402970]/10 text-[#402970] border border-[#402970]/15 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs select-none">
                <RefreshCw size={13} className="text-[#402970]" /> Retry Attempted
              </div>
            ) : (
              <button
                onClick={() => onAction("I want to retry placing my order")}
                className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw size={13} /> Retry Order Submission
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Grid details card layout */}
            <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex flex-col gap-4">
              {step.cartItems && step.cartItems.length > 0 ? (
                <div className="flex flex-col gap-3.5 pb-3.5 border-b border-slate-100">
                  {step.cartItems.map((item, idx) => (
                    <div key={item.id || item.name || idx} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <Package size={20} className="text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-slate-800 truncate">{cleanProductTitle(item.name)}</h5>
                          <p className="text-xs text-slate-400 font-semibold mt-1">
                            Qty: {item.quantity} × Rs. {item.price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-[#402970] shrink-0">
                        Rs. {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-1">
                    <span className="text-xs font-bold text-slate-700">Subtotal</span>
                    <span className="text-base font-black text-[#402970]">Rs. {totalLKR.toLocaleString()}</span>
                  </div>
                </div>
              ) : step.product ? (
                <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
                  {step.product.imageUrl ? (
                    <img
                      src={step.product.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Package size={20} className="text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 truncate">{cleanProductTitle(step.product.name || step.product.title)}</h5>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      Qty: {step.confirmedQuantity || 1} × Rs. {(step.product.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-[#402970] shrink-0">
                    Rs. {totalLKR.toLocaleString()}
                  </span>
                </div>
              ) : null}

              {/* Side-by-side details layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addr && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-[#402970] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Deliver To</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">{addr.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-normal truncate-line-clamp">
                        {addr.address}, {addr.city}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <CreditCard size={13} className="text-[#402970] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Payment</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                      {step.paymentMethod === "cod" ? "Cash on Delivery" : "Card Payment (Online)"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {step.paymentMethod === "card" && step.checkoutUrl && (
              <a
                href={step.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                Open Secure Payment Link <ExternalLink size={13} />
              </a>
            )}

            {step.paymentMethod === "cod" && (
              <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
                <Truck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                  Courier will collect **Rs. {totalLKR.toLocaleString()}** in cash upon delivery.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Out of Stock Variant ───────────────────────────────────────────────────
function OutOfStockBubble({ step }: { step: OrderFlowStepData }) {
  return (
    <div className="w-full bg-white border border-rose-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center shrink-0">
          <AlertCircle size={20} className="text-rose-500" />
        </div>
        <div>
          <h5 className="text-xs font-bold text-rose-700">Currently Out of Stock</h5>
          <p className="text-[11px] text-rose-600/90 mt-1 leading-normal">
            We are sorry, but <strong>{step.product?.name || step.product?.title}</strong> is currently unavailable.
            Please try searching for alternative items or try again later.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export default function OrderStepBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  switch (step.phase) {
    case "qty_ask":
      return <QtyAskBubble step={step} onAction={onAction} isActive={isActive} />;
    case "delivery_ask":
      return <DeliveryAskBubble step={step} onAction={onAction} isActive={isActive} />;
    case "new_address_form":
      return <NewAddressFormBubble step={step} onAction={onAction} isActive={isActive} />;
    case "map_open":
      return <MapOpenBubble step={step} onAction={onAction} isActive={isActive} />;
    case "payment_ask":
      return <PaymentAskBubble step={step} onAction={onAction} isActive={isActive} />;
    case "confirmed":
      return <ConfirmedBubble step={step} onAction={onAction} isActive={isActive} />;
    case "out_of_stock":
      return <OutOfStockBubble step={step} />;
    default:
      return null;
  }
}
