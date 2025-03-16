// app/components/LeafletMap.tsx
import React, { useState, useEffect } from "react";
import ClientOnly from "./ClientOnly";

// Define props for the component
interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function LeafletMap({
  center,
  zoom,
  className,
  style,
}: LeafletMapProps) {
  const [Components, setComponents] = useState<any>(null);

  // Dynamically load react-leaflet components on the client
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    const loadLeaflet = async () => {
      try {
        // Load CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        // Dynamic imports
        const leafletModule = await import("react-leaflet");

        if (isMounted) {
          setComponents({
            MapContainer: leafletModule.MapContainer,
            TileLayer: leafletModule.TileLayer,
            Marker: leafletModule.Marker,
            Popup: leafletModule.Popup,
          });
        }
      } catch (error) {
        console.error("Failed to load Leaflet components:", error);
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
    };
  }, []);

  // On center or zoom change, update the map
  useEffect(() => {
    if (!Components) return;

    const map = document.querySelector(".leaflet-map");
    if (map) {
      map.scrollIntoView({ behavior: "smooth" });
    }
  }, [center, zoom, Components]);

  // Default style if none provided
  const defaultStyle = {
    height: "200px",
    width: "100%",
    borderRadius: "0.375rem",
  };

  const mapStyle = { ...defaultStyle, ...style };

  // Show loading state or render the map
  return (
    <ClientOnly
      fallback={
        <div style={mapStyle} className={className}>
          Loading map...
        </div>
      }
    >
      {Components ? (
        <Components.MapContainer
          center={center}
          zoom={zoom}
          style={mapStyle}
          className={className}
          scrollWheelZoom={false}
        >
          <Components.TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Components.Marker position={center}>
            <Components.Popup>A sample marker</Components.Popup>
          </Components.Marker>
        </Components.MapContainer>
      ) : (
        <div style={mapStyle} className={className}>
          Initializing map...
        </div>
      )}
    </ClientOnly>
  );
}
