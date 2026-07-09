"use client";

import { useSourcingStore, useSourcingActions } from "@/store/useSourcingStore";
import type { CheckoutLink, InlineProduct } from "@/types/sourcing";
import { cleanProductTitle } from "@/lib/product";
import { KAPRUKA_CITIES, KAPRUKA_CITIES_SET } from "@/constants/cities";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Package,
  Phone,
  Plus,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface OrderFlowCardProps {
  product: InlineProduct;
  stockStatus?: "in_stock" | "out_of_stock" | "limited";
  stockQty?: number;
}

type Step =
  | "stock_check"
  | "delivery_confirm"
  | "address_form"
  | "payment_select"
  | "order_summary"
  | "completed";

type PaymentMethod = "cod" | "card";

export default function OrderFlowCard({ product, stockStatus = "in_stock", stockQty }: OrderFlowCardProps) {
  const userAddresses = useSourcingStore(state => state.userAddresses);
  const activeHistoryId = useSourcingStore(state => state.activeHistoryId);
  const setMessages = useSourcingStore(state => state.setMessages);
  
  const { activeUserId } = useSourcingActions();

  const defaultAddr = userAddresses.find(a => a.isDefault) || userAddresses[0];
  const savedDefaults = defaultAddr ? {
    name: defaultAddr.recipientName || "",
    phone: defaultAddr.phone || "",
    address: defaultAddr.formattedAddress || defaultAddr.addressLine || "",
    city: defaultAddr.city || "",
  } : { name: "", phone: "", address: "", city: "" };

  const hasSavedAddress = !!(savedDefaults.address && savedDefaults.city);

  // ── State ──────────────────────────────────────────────────────
  // Start at delivery_confirm (or address_form) — stock was already verified by the AI agent.
  // Only show stock_check step if item is out of stock.
  const getInitialStep = (): Step => {
    if (stockStatus === "out_of_stock") return "stock_check";
    return hasSavedAddress ? "delivery_confirm" : "address_form";
  };

  const [step, setStep] = useState<Step>(getInitialStep);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // Address form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutLink, setCheckoutLink] = useState<CheckoutLink | null>(null);

  // Google Maps
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  // City autocomplete
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const isOutOfStock = stockStatus === "out_of_stock";

  // ── Google Maps init ──────────────────────────────────────────
  const initGoogleMap = async () => {
    if (typeof window === "undefined" || !(window as any).google || !mapRef.current) return;
    const google = (window as any).google;
    const defaultLatLng = { lat: 6.9271, lng: 79.8612 };

    try {
      let MapClass: any;
      let GeocoderClass: any;
      let MarkerClass: any;
      let isAdvancedMarker = false;

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
          isAdvancedMarker = true;
        } else {
          MarkerClass = markerLib.Marker || google.maps.Marker;
        }
      } else {
        MapClass = google.maps.Map;
        GeocoderClass = google.maps.Geocoder;
        MarkerClass = google.maps.Marker;
        if (google.maps.marker && (google.maps.marker as any).AdvancedMarkerElement) {
          MarkerClass = (google.maps.marker as any).AdvancedMarkerElement;
          isAdvancedMarker = true;
        }
      }

      // mapId is required for AdvancedMarkerElement, harmless for legacy Map
      const map = new MapClass(mapRef.current, {
        center: defaultLatLng,
        zoom: 14,
        mapId: "kapruka_delivery_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;

      let marker: any;
      if (isAdvancedMarker) {
        const markerEl = document.createElement("div");
        markerEl.style.cssText = "width:24px;height:24px;background:#402970;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:grab";
        marker = new MarkerClass({
          position: defaultLatLng,
          map,
          content: markerEl,
          gmpDraggable: true,
        });
      } else {
        marker = new MarkerClass({
          position: defaultLatLng,
          map: map,
          draggable: true,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
          }
        });
      }
      markerInstanceRef.current = marker;

      const geocoder = new GeocoderClass();

      const updateLocation = (latLng: any) => {
        if (!latLng || typeof window === "undefined" || !(window as any).google) return;
        const google = (window as any).google;
        const latLngObj = (latLng instanceof google.maps.LatLng)
          ? latLng
          : new google.maps.LatLng(
              typeof latLng.lat === "function" ? latLng.lat() : latLng.lat,
              typeof latLng.lng === "function" ? latLng.lng() : latLng.lng
            );

        if (markerInstanceRef.current) {
          if (isAdvancedMarker) {
            markerInstanceRef.current.position = latLngObj;
          } else {
            markerInstanceRef.current.setPosition(latLngObj);
          }
        }
        geocoder.geocode({ location: latLngObj }, (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            setAddress(results[0].formatted_address);
            const comps = results[0].address_components;
            for (const c of comps) {
              if (c.types.includes("locality") || c.types.includes("sublocality_level_1") || c.types.includes("administrative_area_level_3")) {
                setCity(c.long_name);
                return;
              }
            }
            setCity("Colombo");
          }
        });
      };

      map.addListener("click", (e: any) => updateLocation(e.latLng));
      if (isAdvancedMarker) {
        marker.addListener("gmp-dragend", () => updateLocation(marker.position));
        marker.addListener("dragend", (e: any) => updateLocation(e.latLng || marker.position));
      } else {
        marker.addListener("dragend", (e: any) => updateLocation(e.latLng));
      }
    } catch (error) {
      console.error("Error loading Google Maps libraries:", error);
    }
  };

  useEffect(() => {
    if (step !== "address_form") return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // If Maps is already loaded, init immediately
    if ((window as any).google?.maps) {
      setUseGoogleMaps(true);
      setTimeout(initGoogleMap, 50);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      // Include 'places' and 'marker' libraries; loading=async avoids the duplicate-load warning
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Avoid attaching duplicate listeners if script already loaded
    if ((script as any)._mapsLoaded) {
      setUseGoogleMaps(true);
      setTimeout(initGoogleMap, 50);
      return;
    }

    const handleLoad = () => {
      (script as any)._mapsLoaded = true;
      setUseGoogleMaps(true);
      setTimeout(initGoogleMap, 50);
    };
    script.addEventListener("load", handleLoad);
    return () => script.removeEventListener("load", handleLoad);
  }, [step]);

  // City autocomplete outside click handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCityInput = (val: string) => {
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

  // ── Handlers ──────────────────────────────────────────────────
  const handleUseSavedAddress = () => {
    setName(savedDefaults.name);
    setPhone(savedDefaults.phone);
    setAddress(savedDefaults.address);
    setCity(savedDefaults.city);
    setStep("payment_select");
  };

  const handleUseNewAddress = () => {
    setName("");
    setPhone("");
    setAddress("");
    setCity("");
    setStep("address_form");
  };

  const handleAddressFormNext = () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      alert("Please fill in all delivery details before continuing.");
      return;
    }
    if (!KAPRUKA_CITIES_SET.has(city)) {
      alert("Please select a valid city from the suggestions dropdown.");
      return;
    }
    setStep("payment_select");
  };

  const handlePaymentSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setStep("order_summary");
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          recipient: { name, phone, address, city },
          sessionId: activeHistoryId,
          userId: activeUserId,
          productTitle: cleanProductTitle(product.name || product.title),
          priceLKR: product.price,
          imageUrl: product.imageUrl || product.image,
          paymentMethod,
        }),
      });

      if (!res.ok) throw new Error("Order request failed");
      const data = await res.json();

      if (data.success && data.checkoutLink) {
        const link: CheckoutLink = data.checkoutLink;
        setCheckoutLink(link);

        // Inject the checkout link into the chat timeline
        const confirmMsg = {
          id: `checkout-link-${Date.now()}`,
          sender: "ai" as const,
          text: `Your order has been confirmed! 🎉 ${paymentMethod === "cod" ? "You have selected Cash on Delivery. Please have LKR ${(product.price || 0) * quantity} ready at the time of delivery." : "Your secure payment link is ready. Click below to complete your payment."}`,
          timestamp: new Date(),
          checkoutLinks: [link] as CheckoutLink[],
        };
        setMessages((prev) => [...prev, confirmMsg]);
        if (paymentMethod === "card") window.open(link.checkoutUrl, "_blank");
        setStep("completed");
      } else {
        throw new Error("Invalid order response");
      }
    } catch (err) {
      console.error(err);
      alert("Order failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const priceLKR = product.price || 0;
  const totalPrice = priceLKR * quantity;

  // ── UI ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-xl bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden select-none animate-fadeInScale">
      {/* Product Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name || product.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-800 truncate line-clamp-1">{cleanProductTitle(product.name || product.title)}</h4>
          <p className="text-sm font-extrabold text-[#402970] mt-1">
            {priceLKR > 0 ? `Rs. ${priceLKR.toLocaleString()}` : "Price on request"}
          </p>
        </div>
        {step !== "completed" && (
          <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="p-1 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 transition-colors"
            >
              <Minus size={12} />
            </button>
            <span className="text-xs font-bold w-4 text-center text-slate-700">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 hover:bg-slate-50 rounded text-slate-500 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── Step: Stock Check ── */}
      {step === "stock_check" && (
        <div className="p-5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-[#402970]" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Stock Availability</span>
          </div>

          {isOutOfStock ? (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl">
              <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-700">Out of Stock</p>
                <p className="text-xs text-rose-600 mt-0.5">
                  Sorry, this item is currently unavailable. We'll notify you when it's back.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-700">In Stock</p>
                {stockQty !== undefined && stockQty <= 10 ? (
                  <p className="text-xs text-amber-600 mt-0.5 font-semibold">Only {stockQty} left — order soon!</p>
                ) : (
                  <p className="text-xs text-emerald-600 mt-0.5">Ready to ship within 1–2 business days.</p>
                )}
              </div>
            </div>
          )}

          {!isOutOfStock && (
            <>
              <button
                onClick={() => {
                  if (hasSavedAddress) {
                    setStep("delivery_confirm");
                  } else {
                    setStep("address_form");
                  }
                }}
                className="w-full py-2.5 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                Proceed to Delivery <ChevronRight size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Step: Confirm Saved Delivery Location ── */}
      {step === "delivery_confirm" && (
        <div className="p-5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <Home size={16} className="text-[#402970]" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Delivery Location</span>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Should we deliver to your <span className="font-bold text-slate-800">saved address</span>?
          </p>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <User size={13} className="text-[#402970] shrink-0" />
              <span className="text-xs font-bold text-slate-700">{savedDefaults.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-[#402970] shrink-0" />
              <span className="text-xs text-slate-600 font-semibold">{savedDefaults.phone}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-[#402970] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-600 font-semibold">{savedDefaults.address}, {savedDefaults.city}</span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={handleUseSavedAddress}
              className="flex-1 py-2.5 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <CheckCircle size={13} /> Yes, deliver here
            </button>
            <button
              onClick={handleUseNewAddress}
              className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Navigation size={13} /> Use new address
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Address Form (new address) ── */}
      {step === "address_form" && (
        <div className="p-5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-[#402970]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Enter Delivery Details</span>
            </div>
            {hasSavedAddress && (
              <button
                onClick={() => setStep("delivery_confirm")}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#402970] transition-colors cursor-pointer"
              >
                <ChevronLeft size={13} /> Back
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <User size={10} /> Recipient Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Phone size={10} /> Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
            </div>
          </div>

          {/* Map section */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
              <MapPin size={10} /> Select Delivery Location on Map
            </label>
            <div className="w-full border border-slate-200 rounded-xl overflow-hidden relative shadow-inner bg-slate-100 h-[320px] sm:h-[400px] flex items-center justify-center">
              {useGoogleMaps ? (
                <div ref={mapRef} className="w-full h-full" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#402970]" />
                  <span className="text-xs font-semibold">Loading Google Maps...</span>
                </div>
              )}
            </div>
          </div>

          {/* Address inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Delivery Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1 relative" ref={suggestionsRef}>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => handleCityInput(e.target.value)}
                placeholder="Colombo 3"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
              {showSuggestions && citySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-lg shadow-lg z-30 p-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {citySuggestions.map((sug) => (
                    <button
                      key={sug.name}
                      onClick={() => { setCity(sug.name); setShowSuggestions(false); }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 font-semibold hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                    >
                      {sug.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleAddressFormNext}
            className="w-full py-2.5 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            Continue to Payment <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Step: Payment Method ── */}
      {step === "payment_select" && (
        <div className="p-5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#402970]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Method</span>
            </div>
            <button
              onClick={() => setStep(hasSavedAddress ? "delivery_confirm" : "address_form")}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#402970] transition-colors cursor-pointer"
            >
              <ChevronLeft size={13} /> Back
            </button>
          </div>

          <p className="text-sm text-slate-600">How would you like to pay for your order?</p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => handlePaymentSelect("cod")}
              className="w-full flex items-center gap-3.5 p-4 border-2 border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <Truck size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">Cash on Delivery</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Pay in cash when your order arrives</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-[#402970] transition-colors" />
            </button>

            <button
              onClick={() => handlePaymentSelect("card")}
              className="w-full flex items-center gap-3.5 p-4 border-2 border-slate-100 hover:border-[#402970] bg-white hover:bg-[#402970]/5 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 bg-[#402970]/10 border border-[#402970]/10 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#402970]/20 transition-colors">
                <CreditCard size={18} className="text-[#402970]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">Credit / Debit Card</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Secure online payment via Kapruka checkout</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-[#402970] transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Order Summary ── */}
      {step === "order_summary" && (
        <div className="p-5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-[#402970]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Order Summary</span>
            </div>
            <button
              onClick={() => setStep("payment_select")}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#402970] transition-colors cursor-pointer"
            >
              <ChevronLeft size={13} /> Back
            </button>
          </div>

          {/* Summary rows */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-2 border-b border-slate-100 pb-2.5">
              <Package size={13} className="text-[#402970] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product</p>
                <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{product.name || product.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Qty: {quantity} × Rs. {priceLKR.toLocaleString()}</p>
              </div>
              <span className="text-xs font-bold text-[#402970] shrink-0">Rs. {totalPrice.toLocaleString()}</span>
            </div>

            <div className="flex items-start gap-2 border-b border-slate-100 pb-2.5">
              <MapPin size={13} className="text-[#402970] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery To</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{name}</p>
                <p className="text-[11px] text-slate-500">{phone}</p>
                <p className="text-[11px] text-slate-500 truncate">{address}, {city}</p>
              </div>
              <button
                onClick={() => setStep(hasSavedAddress && address === savedDefaults.address ? "delivery_confirm" : "address_form")}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <CreditCard size={13} className="text-[#402970] shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  {paymentMethod === "cod" ? "Cash on Delivery" : "Card Payment (Online)"}
                </p>
              </div>
              <button
                onClick={() => setStep("payment_select")}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
              </button>
            </div>
          </div>

          {/* Total + Confirm */}
          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total (LKR)</span>
              <p className="text-base font-extrabold text-slate-800">Rs. {totalPrice.toLocaleString()}</p>
            </div>
            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <><Loader2 size={12} className="animate-spin" /> Placing Order...</>
              ) : (
                <>{paymentMethod === "cod" ? "Confirm Order" : "Pay Now"} <ExternalLink size={12} /></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Completed ── */}
      {step === "completed" && (
        <div className="p-6 flex flex-col items-center justify-center text-center gap-3 bg-white animate-fadeIn">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center">
            <CheckCircle size={28} />
          </div>
          <div>
            <h5 className="text-sm font-bold text-slate-800">Order Confirmed! 🎉</h5>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              {paymentMethod === "cod"
                ? "Your Cash on Delivery order has been placed. Please have the payment ready when the courier arrives."
                : "Your secure checkout link has been posted in the chat. Please complete the payment to finalize your order."}
            </p>
          </div>
          {checkoutLink && paymentMethod === "card" && (
            <a
              href={checkoutLink.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 px-5 py-2 bg-[#402970] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-[#301e54] transition-colors"
            >
              Open Payment Link <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
