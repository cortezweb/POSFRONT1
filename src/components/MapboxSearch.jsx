import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { searchAddress, calculateDistance, reverseGeocode } from "../utils/mapboxService";
import { Search, MapPin, Loader2, Info, Locate } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export const MapboxSearch = ({ onAddressSelected }) => {
  const { 
    customerAddress, 
    setCustomerAddress, 
    setShippingCost, 
    setShippingDistance, 
    setCustomerCoords,
    customerCoords,
    businessConfig 
  } = useCart();

  const [query, setQuery] = useState(customerAddress || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mapError, setMapError] = useState(false);
  
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);
  
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const pizzaMarkerRef = useRef(null);

  // Referencias para evitar cierres obsoletos (stale closures) en callbacks de Mapbox
  const businessConfigRef = useRef(businessConfig);
  const customerCoordsRef = useRef(customerCoords);
  const onAddressSelectedRef = useRef(onAddressSelected);
  const handleMarkerDragRef = useRef(null);

  useEffect(() => {
    businessConfigRef.current = businessConfig;
  }, [businessConfig]);

  useEffect(() => {
    customerCoordsRef.current = customerCoords;
  }, [customerCoords]);

  useEffect(() => {
    onAddressSelectedRef.current = onAddressSelected;
  }, [onAddressSelected]);

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const hasToken = token && !token.includes("PLACEHOLDER");

  // Sincronizar query local si la dirección en el carrito cambia externamente
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(customerAddress || "");
  }, [customerAddress]);

  // Cerrar sugerencias si se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dibujar y encuadrar marcadores y ruta en el mapa
  const updateMapLocation = (lng, lat, routeCoords = []) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const origin = businessConfigRef.current?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };

    // Marcador del Cliente (Destino) - Punto Rojo Pulsante
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "user-map-marker";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.cursor = "move";
      el.style.position = "relative";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

      // Anillo exterior con animación pulsante
      const pulseRing = document.createElement("div");
      pulseRing.style.position = "absolute";
      pulseRing.style.width = "36px";
      pulseRing.style.height = "36px";
      pulseRing.style.borderRadius = "50%";
      pulseRing.style.backgroundColor = "rgba(226, 54, 54, 0.4)";
      pulseRing.style.animation = "pulse-marker 1.6s infinite ease-out";
      pulseRing.style.pointerEvents = "none";

      // Punto central rojo sólido
      const centerDot = document.createElement("div");
      centerDot.style.position = "relative";
      centerDot.style.width = "14px";
      centerDot.style.height = "14px";
      centerDot.style.borderRadius = "50%";
      centerDot.style.backgroundColor = "#e23636";
      centerDot.style.border = "2px solid #ffffff";
      centerDot.style.boxShadow = "0 0 6px rgba(0,0,0,0.6)";

      el.appendChild(pulseRing);
      el.appendChild(centerDot);

      userMarkerRef.current = new mapboxgl.Marker(el, { draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      // Evento al arrastrar el marcador manualmente
      userMarkerRef.current.on("dragend", async () => {
        const newLngLat = userMarkerRef.current.getLngLat();
        if (handleMarkerDragRef.current) {
          await handleMarkerDragRef.current(newLngLat.lng, newLngLat.lat);
        }
      });
    }

    // Dibujar la línea de la ruta
    if (routeCoords && routeCoords.length > 0) {
      const geojson = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routeCoords
        }
      };

      if (map.getSource("route")) {
        map.getSource("route").setData(geojson);
      } else {
        map.addSource("route", {
          type: "geojson",
          data: geojson
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": "#ffd79b",
            "line-width": 4,
            "line-opacity": 0.8
          }
        });
      }
    } else {
      // Limpiar ruta previa si no hay coords
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");
    }

    // Ajustar límites para mostrar ambos marcadores
    const bounds = new mapboxgl.LngLatBounds()
      .extend([origin.lng, origin.lat])
      .extend([lng, lat]);

    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 15,
      duration: 1200
    });
  };

  // Manejar el arrastre manual del marcador de entrega
  const handleMarkerDrag = async (lng, lat) => {
    setLoading(true);
    try {
      const addressName = await reverseGeocode(lng, lat);
      setQuery(addressName);
      setCustomerAddress(addressName);

      const origin = businessConfigRef.current?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };
      const { distance, coordinates } = await calculateDistance(origin, { lat, lng });
      const costPerKm = businessConfigRef.current?.shipping?.shippingCostPerKm || 1.5;
      const finalCost = Math.max(0, distance * costPerKm);

      setShippingDistance(distance);
      setShippingCost(finalCost);
      setCustomerCoords({ lat, lng });

      // Dibujar la ruta actualizada en el mapa
      if (mapRef.current) {
        const map = mapRef.current;
        const geojson = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates
          }
        };

        if (map.getSource("route")) {
          map.getSource("route").setData(geojson);
        } else {
          map.addSource("route", {
            type: "geojson",
            data: geojson
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round"
            },
            paint: {
              "line-color": "#ffd79b",
              "line-width": 4,
              "line-opacity": 0.8
            }
          });
        }
      }

      if (onAddressSelectedRef.current) {
        onAddressSelectedRef.current({
          address: addressName,
          distance,
          cost: finalCost,
          center: { lng, lat }
        });
      }
    } catch (err) {
      console.error("Error al arrastrar marcador de Mapbox:", err);
    } finally {
      setLoading(false);
    }
  };

  // Mantener actualizado el ref del drag handler
  useEffect(() => {
    handleMarkerDragRef.current = handleMarkerDrag;
  });

  // Obtener ubicación GPS actual y centrar el mapa
  const locateUserGPS = (showErrorAlert = true) => {
    if (!navigator.geolocation) {
      if (showErrorAlert) {
        alert("Tu navegador o dispositivo no soporta la detección de ubicación GPS.");
      }
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const addressName = await reverseGeocode(longitude, latitude);
          setQuery(addressName);
          setCustomerAddress(addressName);
          setCustomerCoords({ lat: latitude, lng: longitude });

          const origin = businessConfigRef.current?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };
          const { distance, coordinates } = await calculateDistance(origin, { lat: latitude, lng: longitude });
          const costPerKm = businessConfigRef.current?.shipping?.shippingCostPerKm || 1.5;
          const finalCost = Math.max(0, distance * costPerKm);

          setShippingDistance(distance);
          setShippingCost(finalCost);

          updateMapLocation(longitude, latitude, coordinates);

          if (onAddressSelectedRef.current) {
            onAddressSelectedRef.current({
              address: addressName,
              distance,
              cost: finalCost,
              center: { lng: longitude, lat: latitude }
            });
          }
        } catch (err) {
          console.error("Error procesando geolocalización GPS:", err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.warn("Error de geolocalización GPS:", error);
        setLoading(false);
        if (showErrorAlert) {
          let msg = "No se pudo obtener tu ubicación actual.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Permiso de ubicación denegado. Activa el acceso GPS en tu navegador para ubicarte automáticamente.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = "La señal de GPS o información de ubicación no está disponible.";
          } else if (error.code === error.TIMEOUT) {
            msg = "Tiempo de espera agotado al intentar geolocalizar tu dispositivo.";
          }
          alert(msg);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Inicializar mapa de Mapbox
  useEffect(() => {
    if (!hasToken || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const origin = businessConfig?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [origin.lng, origin.lat],
        zoom: 13,
        attributionControl: false
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Cargar marcador del restaurante (Origen)
      const el = document.createElement("div");
      el.className = "pizza-map-marker";
      el.style.fontSize = "26px";
      el.style.cursor = "pointer";
      el.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.6))";
      el.innerHTML = "🌶️";

      pizzaMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([origin.lng, origin.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="color:#000;font-family:sans-serif;font-size:12px;font-weight:bold;padding:2px;">🌶️ ${businessConfigRef.current?.name || "Sabor Boliviano"} (Origen)</div>`
          )
        )
        .addTo(map);

      mapRef.current = map;

      // Esperar a que el mapa cargue para pintar la ubicación y trazar rutas
      map.on("load", async () => {
        const existingCoords = customerCoordsRef.current;
        if (existingCoords && existingCoords.lat && existingCoords.lng) {
          setLoading(true);
          try {
            const originLocation = businessConfigRef.current?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };
            const { distance, coordinates } = await calculateDistance(originLocation, existingCoords);
            updateMapLocation(existingCoords.lng, existingCoords.lat, coordinates);
          } catch (err) {
            console.error("Error cargando ubicación previa en el mapa:", err);
          } finally {
            setLoading(false);
          }
        } else {
          // Si no hay coordenadas previas guardadas, obtener ubicación GPS automáticamente
          locateUserGPS(false);
        }
      });

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error al inicializar Mapbox GL:", err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(true);
    }
  }, [hasToken, token]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setCustomerAddress(val);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (val.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(true);

    timeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setSuggestions(results);
      setLoading(false);
    }, 450);
  };

  const handleSelectSuggestion = async (suggestion) => {
    setQuery(suggestion.placeName);
    setCustomerAddress(suggestion.placeName);
    setSuggestions([]);
    setIsOpen(false);

    const origin = businessConfigRef.current?.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };
    const destination = suggestion.center;

    setLoading(true);
    try {
      const { distance, coordinates } = await calculateDistance(origin, destination);
      const costPerKm = businessConfigRef.current?.shipping?.shippingCostPerKm || 1.5;
      const finalCost = Math.max(0, distance * costPerKm);
      
      setShippingDistance(distance);
      setShippingCost(finalCost);
      setCustomerCoords({ lat: destination.lat, lng: destination.lng });

      // Mapear visualmente
      updateMapLocation(destination.lng, destination.lat, coordinates);
      
      if (onAddressSelectedRef.current) {
        onAddressSelectedRef.current({
          address: suggestion.placeName,
          distance,
          cost: finalCost,
          center: destination
        });
      }
    } catch (err) {
      console.error("Error al calcular distancia para envío:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Busca tu dirección para el delivery..."
          className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder-white/40 focus:outline-none focus:border-[#e23636] transition-all text-sm animate-fade-in"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-[#e23636]" />
          ) : (
            <Search size={16} />
          )}
        </div>
        <button
          type="button"
          onClick={() => locateUserGPS(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#e23636] transition-colors p-1"
          title="Usar mi ubicación GPS actual"
        >
          <Locate size={16} className="transition-transform active:scale-95" />
        </button>
      </div>

      {isOpen && (suggestions.length > 0 || loading) && (
        <div className="absolute z-50 w-full bg-[#181818] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden backdrop-blur-xl">
          {loading && suggestions.length === 0 ? (
            <div className="p-4 text-center text-sm text-white/50 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[#ffd79b]" />
              Buscando en Mapbox...
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="flex items-start gap-2.5 px-4 py-3 hover:bg-black/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                >
                  <MapPin size={16} className="text-[#ffd79b] shrink-0 mt-0.5" />
                  <span className="text-sm text-white text-left line-clamp-2">
                    {suggestion.placeName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Mapa Visual de Mapbox */}
      {hasToken && !mapError ? (
        <div className="space-y-1">
          <div 
            ref={mapContainerRef} 
            className="w-full h-56 rounded-2xl border border-white/10 relative overflow-hidden bg-black/40"
            style={{ minHeight: "220px" }}
          />
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 px-1">
            <Info size={10} className="text-[#ffd79b]" />
            <span>Puedes arrastrar el punto rojo en el mapa para ajustar la dirección exacta.</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-xs text-gray-500 text-center">
          ⚠️ Mapa no disponible o token de Mapbox inválido. Ingresa tu dirección manualmente en el buscador.
        </div>
      )}
    </div>
  );
};
