const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

/**
 * Busca direcciones coincidentes usando la API de Geocodificación de Mapbox.
 */
export const searchAddress = async (query) => {
  if (!MAPBOX_TOKEN || !query || MAPBOX_TOKEN.includes("PLACEHOLDER")) return [];
  try {
    // Reemplaza 'PE' por el país adecuado o quita el filtro si quieres geocodificación global
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=address,poi`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features) {
      return data.features.map((feature) => ({
        id: feature.id,
        placeName: feature.place_name,
        center: {
          lng: feature.center[0],
          lat: feature.center[1]
        }
      }));
    }
    return [];
  } catch (error) {
    console.error("Error al buscar dirección en Mapbox:", error);
    return [];
  }
};

/**
 * Calcula la distancia de conducción en carretera (en kilómetros) entre origen y destino y retorna ruta.
 * @param {Object} origin - { lat, lng } ubicación de la pizzería.
 * @param {Object} destination - { lat, lng } ubicación del cliente.
 */
export const calculateDistance = async (origin, destination) => {
  if (!MAPBOX_TOKEN || !origin || !destination || MAPBOX_TOKEN.includes("PLACEHOLDER")) {
    return { distance: 0, coordinates: [] };
  }
  try {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${MAPBOX_TOKEN}&overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      // La distancia retornada por Mapbox está en metros. Convertimos a Kilómetros.
      return {
        distance: data.routes[0].distance / 1000,
        coordinates: data.routes[0].geometry.coordinates
      };
    }
    return { distance: 0, coordinates: [] };
  } catch (error) {
    console.error("Error al calcular la distancia con Mapbox Directions:", error);
    return { distance: 0, coordinates: [] };
  }
};

/**
 * Obtiene el nombre legible de una ubicación a partir de sus coordenadas (Geocodificación Inversa).
 */
export const reverseGeocode = async (lng, lat) => {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("PLACEHOLDER")) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (error) {
    console.error("Error en reverseGeocode:", error);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};
