"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, User, Phone, ShoppingBag, Plus, Minus, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";
import type { InlineProduct, CheckoutLink } from "@/types/sourcing";

interface CheckoutCardProps {
  product: InlineProduct;
}

const getUserCheckoutDefaults = (userId: string) => {
  if (userId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071") {
    return {
      name: "Kamal Silva",
      phone: "0771234567",
      address: "123 Galle Road, Colombo 3",
      city: "Colombo 3",
    };
  } else if (userId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32") {
    return {
      name: "Nimal Perera",
      phone: "0719876543",
      address: "45 Flower Road, Colombo 7",
      city: "Colombo 7",
    };
  }
  return {
    name: "",
    phone: "",
    address: "",
    city: "",
  };
};

export default function CheckoutCard({ product }: CheckoutCardProps) {
  const { activeUserId, activeHistoryId, setMessages } = useSourcing();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Dynamic Google Maps Integration states
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);

  // Autocomplete state
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Google Maps Instance References
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderInstanceRef = useRef<any>(null);
  const isAdvancedMarkerRef = useRef<boolean>(false);

  // Load Google Maps script or check local environment key
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing in env variables.");
      return;
    }

    if (typeof window !== "undefined" && (window as any).google && (window as any).google.maps) {
      setUseGoogleMaps(true);
      setTimeout(() => initGoogleMap(), 50);
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
      setTimeout(() => initGoogleMap(), 50);
      return;
    }

    const handleLoad = () => {
      (script as any)._mapsLoaded = true;
      setUseGoogleMaps(true);
      setTimeout(() => initGoogleMap(), 50);
    };

    script.addEventListener("load", handleLoad);

    return () => {
      script.removeEventListener("load", handleLoad);
    };
  }, []);

  const initGoogleMap = async () => {
    if (typeof window === "undefined" || !(window as any).google || !mapRef.current) return;
    const google = (window as any).google;

    let defaultLatLng = { lat: 6.9271, lng: 79.8612 };
    if (activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071") {
      defaultLatLng = { lat: 6.9157, lng: 79.8510 };
    } else if (activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32") {
      defaultLatLng = { lat: 6.9064, lng: 79.8698 };
    }

    try {
      let MapClass: any;
      let GeocoderClass: any;
      let MarkerClass: any;
      let isAdvancedMarker = false;

      MapClass = google.maps.Map;
      GeocoderClass = google.maps.Geocoder;
      MarkerClass = google.maps.Marker;
      if (google.maps.marker && (google.maps.marker as any).AdvancedMarkerElement) {
        MarkerClass = (google.maps.marker as any).AdvancedMarkerElement;
        isAdvancedMarker = true;
      }

      isAdvancedMarkerRef.current = isAdvancedMarker;

      const map = new MapClass(mapRef.current, {
        center: defaultLatLng,
        zoom: 14,
        mapId: "kapruka_delivery_map",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
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
      geocoderInstanceRef.current = geocoder;

      map.addListener("click", (e: any) => {
        updateGoogleLocation(e.latLng);
      });

      if (isAdvancedMarker) {
        marker.addListener("gmp-dragend", () => {
          updateGoogleLocation(marker.position);
        });
      } else {
        marker.addListener("dragend", (e: any) => {
          updateGoogleLocation(e.latLng);
        });
      }
    } catch (error) {
      console.error("Error loading Google Maps libraries:", error);
    }
  };

  const updateGoogleLocation = (latLng: any) => {
    if (!latLng || typeof window === "undefined" || !(window as any).google) return;
    const google = (window as any).google;

    if (markerInstanceRef.current) {
      if (isAdvancedMarkerRef.current) {
        markerInstanceRef.current.position = latLng;
      } else {
        markerInstanceRef.current.setPosition(latLng);
      }
    }

    const geocoder = geocoderInstanceRef.current || new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, (results: any, status: any) => {
      if (status === "OK" && results[0]) {
        const formattedAddress = results[0].formatted_address;
        setAddress(formattedAddress);

        const addressComponents = results[0].address_components;
        let foundCity = "";
        for (const comp of addressComponents) {
          if (
            comp.types.includes("locality") ||
            comp.types.includes("sublocality_level_1") ||
            comp.types.includes("sublocality") ||
            comp.types.includes("administrative_area_level_3")
          ) {
            foundCity = comp.long_name;
            break;
          }
        }
        if (foundCity) {
          setCity(foundCity);
        } else {
          setCity("Colombo");
        }
      }
    });
  };

  useEffect(() => {
    const d = getUserCheckoutDefaults(activeUserId);
    setName(d.name);
    setPhone(d.phone);
    setAddress(d.address);
    setCity(d.city);

    if (useGoogleMaps && typeof window !== "undefined" && (window as any).google && mapInstanceRef.current && markerInstanceRef.current) {
      let newLatLng = { lat: 6.9271, lng: 79.8612 };
      if (activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071") {
        newLatLng = { lat: 6.9157, lng: 79.8510 };
      } else if (activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32") {
        newLatLng = { lat: 6.9064, lng: 79.8698 };
      }
      mapInstanceRef.current.setCenter(newLatLng);
      if (isAdvancedMarkerRef.current) {
        markerInstanceRef.current.position = newLatLng;
      } else {
        markerInstanceRef.current.setPosition(newLatLng);
      }
    }
  }, [activeUserId, useGoogleMaps]);

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

  const handleCityChange = async (val: string) => {
    setCity(val);
    if (val.length >= 2) {
      try {
        const res = await fetch(`/api/delivery?q=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          setCitySuggestions(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Failed to fetch cities:", err);
      }
    } else {
      setCitySuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (cityName: string) => {
    setCity(cityName);
    setShowSuggestions(false);
  };

  const handleConfirmCheckout = async () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      alert("Please fill in all checkout details before confirming.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          recipient: { name, phone, address, city },
          sessionId: activeHistoryId,
          userId: activeUserId,
          productTitle: product.name || product.title,
          priceLKR: product.price,
          imageUrl: product.imageUrl || product.image,
        }),
      });

      if (!response.ok) {
        throw new Error("Checkout call failed");
      }

      const resData = await response.json();
      if (resData.success && resData.checkoutLink) {
        const newMsg = {
          id: `checkout-link-${Date.now()}`,
          sender: "ai" as const,
          text: `Your checkout link has been generated successfully. Please click below to complete the payment.`,
          timestamp: new Date(),
          checkoutLinks: [resData.checkoutLink] as CheckoutLink[],
        };

        setMessages((prev) => [...prev, newMsg]);
        window.open(resData.checkoutLink.checkoutUrl, "_blank");
        setIsCompleted(true);
      } else {
        throw new Error("Invalid checkout result response");
      }
    } catch (err) {
      console.error(err);
      alert("Checkout failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const priceLKR = product.price || 0;
  const formattedPrice = priceLKR > 0 ? `Rs. ${priceLKR.toLocaleString()}` : "Price upon request";
  const totalPrice = priceLKR * quantity;

  return (
    <div className="w-full max-w-xl bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden select-none animate-fadeInScale">
      {/* Product Summary Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name || product.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-800 truncate line-clamp-1">
            {product.name || product.title}
          </h4>
          <p className="text-[11px] font-semibold text-[#402970] mt-0.5">
            {formattedPrice}
          </p>
        </div>
        {!isCompleted && (
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

      {isCompleted ? (
        <div className="p-6 flex flex-col items-center justify-center text-center gap-3 bg-white">
          <div className="w-12 h-12 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center animate-bounce">
            <CheckCircle size={24} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">Checkout Link Generated!</h5>
            <p className="text-[11px] text-slate-500 mt-1">
              A secure 60-minute checkout link has been posted in the chat timeline. Please complete your payment there.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4 bg-white">
          {/* Recipient Details Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <User size={10} /> Recipient Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kamal Silva"
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
                placeholder="0771234567"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
            </div>
          </div>

          {/* Map Section */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
              <MapPin size={10} /> Select Delivery Location on Map
            </label>
            <div className="w-full border border-slate-200 rounded-xl overflow-hidden relative shadow-inner select-none bg-slate-100 h-[320px] sm:h-[400px] flex items-center justify-center">
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

          {/* Delivery Details Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Delivery Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Galle Road"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1 relative" ref={suggestionsRef}>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="Colombo 3"
                className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-[#402970] focus:ring-1 focus:ring-[#402970] outline-none bg-slate-50/50 transition-all"
              />
              {showSuggestions && citySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-lg shadow-lg z-30 p-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {citySuggestions.map((sug) => (
                    <button
                      key={sug.name}
                      onClick={() => handleSelectSuggestion(sug.name)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 font-semibold hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                    >
                      {sug.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subtotal & Confirm Button */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Price (LKR)
              </span>
              <span className="text-sm font-bold text-slate-800">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>

            <button
              onClick={handleConfirmCheckout}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  Confirm Checkout <ExternalLink size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
