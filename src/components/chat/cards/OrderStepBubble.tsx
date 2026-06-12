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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface OrderStepBubbleProps {
  step: OrderFlowStepData;
  onAction: (userMessage: string) => void;
  isActive?: boolean;
}

// ── Quantity Ask Variant ───────────────────────────────────────────────────
function QtyAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const [qty, setQty] = useState(1);
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const maxQty = step.stockQty ?? 50;
  const hasError = !!step.errorMessage;

  const handleConfirm = () => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSubmitted(true);
    onAction(`I'd like to order ${qty} unit${qty > 1 ? "s" : ""}`);
  };

  const unitPrice = step.product?.price || 0;
  const totalPrice = unitPrice * qty;

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <Package size={16} />
        </span>
        <div>
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Confirm Quantity</h4>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Step 1 of 4: Select quantity</p>
        </div>
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
            <h5 className="text-xs font-bold text-slate-800 truncate line-clamp-1">
              {step.product?.name || step.product?.title}
            </h5>
            {unitPrice > 0 && (
              <p className="text-[11px] font-semibold text-[#402970] mt-1">
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
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Subtotal (LKR)</span>
            <span className="text-base font-black text-[#402970]">
              Rs. {totalPrice.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Action CTA */}
      <button
        onClick={handleConfirm}
        disabled={submitted || !isActive}
        className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 cursor-pointer"
      >
        {submitted || !isActive ? (
          <>
            <CheckCircle size={13} /> {submitted ? "Confirming quantity..." : "Quantity Confirmed"}
          </>
        ) : (
          <>
            Confirm {qty} Unit{qty > 1 ? "s" : ""} <ChevronRight size={13} />
          </>
        )}
      </button>
    </div>
  );
}

// ── Delivery Ask Variant ───────────────────────────────────────────────────
function DeliveryAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const addr = step.savedAddress;
  const hasAddr = !!(addr?.address && addr?.city);

  const handleSaved = () => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSubmitted(true);
    onAction("Yes, deliver to my saved address");
  };
  const handleNew = () => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSubmitted(true);
    onAction("I want to use a new delivery address");
  };

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <MapPin size={16} />
        </span>
        <div>
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Delivery Details</h4>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Step 2 of 4: Select address</p>
        </div>
      </div>

      {/* Address Details Container */}
      <div className="mb-5">
        {hasAddr ? (
          <div className="p-4 bg-slate-50/60 border border-slate-100/80 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-slate-100/50 pb-2">
              <User size={13} className="text-[#402970] shrink-0" />
              <span className="text-xs font-bold text-slate-700">{addr!.name}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-600 font-semibold">{addr!.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-slate-600 font-semibold truncate-line-clamp leading-relaxed">
                  {addr!.address}, {addr!.city}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <MapPin size={22} className="text-slate-300" />
            <p className="text-[11px] text-slate-500 font-medium max-w-xs leading-normal">
              No saved address found on file. Pin your delivery location on the map to proceed.
            </p>
          </div>
        )}
      </div>

      {/* Side-by-side Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hasAddr && (
          <button
            onClick={handleSaved}
            disabled={submitted || !isActive}
            className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle size={13} /> Yes, deliver here
          </button>
        )}
        <button
          onClick={handleNew}
          disabled={submitted || !isActive}
          className={`w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer ${
            !hasAddr ? "sm:col-span-2" : ""
          }`}
        >
          <Navigation size={13} className="text-slate-500" />
          {hasAddr ? "Use new address" : "Pin delivery location"}
        </button>
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
    const google = (window as any).google;
    const center = { lat: geo.lat, lng: geo.lng };

    try {
      let MapClass = google.maps.Map;
      let GeocoderClass = google.maps.Geocoder;
      let MarkerClass = google.maps.Marker;
      let isAdvanced = false;

      if (google.maps.marker && (google.maps.marker as any).AdvancedMarkerElement) {
        MarkerClass = (google.maps.marker as any).AdvancedMarkerElement;
        isAdvanced = true;
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
        if (markerInstanceRef.current) {
          isAdvanced ? (markerInstanceRef.current.position = latLng) : markerInstanceRef.current.setPosition(latLng);
        }
        geocoder.geocode({ location: latLng }, (results: any, status: any) => {
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

      setConfirmedAddress(geo.formattedAddress);
      updateAddr(center);
      if (isActive) {
        map.addListener("click", (e: any) => updateAddr(e.latLng));
        isAdvanced ? marker.addListener("gmp-dragend", () => updateAddr(marker.position)) : marker.addListener("dragend", (e: any) => updateAddr(e.latLng));
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
  }, []);

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
        <div>
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            {mapsLoadFailed ? "Enter Delivery Address" : "Pin Location"}
          </h4>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Step 2 of 4: Drag pin to exact address</p>
        </div>
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

        <button
          onClick={handleConfirmLocation}
          disabled={submitted || !canConfirm || !isActive}
          className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          {submitted || !isActive ? (
            <>
              <CheckCircle size={13} /> Location Confirmed
            </>
          ) : (
            <>
              <CheckCircle size={13} /> Confirm this location
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Payment Ask Variant ────────────────────────────────────────────────────
function PaymentAskBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const totalLKR = (step.product?.price || 0) * (step.confirmedQuantity || 1);

  const handle = (method: "cod" | "card") => {
    if (submittedRef.current || !isActive) return;
    submittedRef.current = true;
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
        <div>
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Payment Method</h4>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Step 3 of 4: Select payment option</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {totalLKR > 0 && (
          <div className="flex items-center justify-between text-xs px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-slate-500 font-bold">
              {step.confirmedQuantity || 1} × {step.product?.name || step.product?.title}
            </span>
            <span className="font-extrabold text-[#402970]">Rs. {totalLKR.toLocaleString()}</span>
          </div>
        )}

        {/* Side-by-side grid card items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handle("cod")}
            disabled={submitted || !isActive}
            className="group flex flex-col justify-between p-5 border-2 border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 rounded-2xl text-left transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.98] h-36"
          >
            <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
              <Truck size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Cash on Delivery</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
                Pay in cash when our courier delivers the package
              </p>
            </div>
          </button>

          <button
            onClick={() => handle("card")}
            disabled={submitted || !isActive}
            className="group flex flex-col justify-between p-5 border-2 border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 rounded-2xl text-left transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.98] h-36"
          >
            <div className="w-10 h-10 bg-[#402970]/10 border border-[#402970]/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#402970]/20 transition-colors">
              <CreditCard size={20} className="text-[#402970]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Credit / Debit Card</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
                Pay securely online using Kapruka checkout
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmed Variant ──────────────────────────────────────────────────────
function ConfirmedBubble({ step, onAction, isActive = true }: OrderStepBubbleProps) {
  const addr = step.confirmedAddress;
  const totalLKR = (step.product?.price || 0) * (step.confirmedQuantity || 1);
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
            className={`text-xs font-extrabold uppercase tracking-wider ${
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
            <button
              onClick={() => onAction("I want to retry placing my order")}
              disabled={!isActive}
              className="w-full py-3 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} /> Retry Order Submission
            </button>
          </div>
        ) : (
          <>
            {/* Grid details card layout */}
            <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex flex-col gap-4">
              {step.product && (
                <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
                  {step.product.imageUrl ? (
                    <img
                      src={step.product.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Package size={20} className="text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 truncate">{step.product.name || step.product.title}</h5>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Qty: {step.confirmedQuantity || 1} × Rs. {(step.product.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-[#402970] shrink-0">
                    Rs. {totalLKR.toLocaleString()}
                  </span>
                </div>
              )}

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
