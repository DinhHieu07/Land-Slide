"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix cho default marker icon
if (typeof window !== "undefined") {
    delete (L.Icon.Default.prototype)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
}

interface LocationPickerMapProps {
    onLocationSelect: (lat: number, lon: number) => void;
    initialLat?: number;
    initialLon?: number;
}

// Hàm xử lý click trên map
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lon: number) => void }) {
    useMapEvents({
        // @ts-expect-error - react-leaflet event type
        click: (e) => {
            const { lat, lng } = e.latlng;
            onLocationSelect(lat, lng);
        },
    });
    return null;
}

// Hàm xử lý kích thước map
function MapSizeFixer() {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
}

export function LocationPickerMap({ onLocationSelect, initialLat, initialLon }: LocationPickerMapProps) {
    const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
        initialLat && initialLon ? [initialLat, initialLon] : null
    );
    
    const center: [number, number] = initialLat && initialLon 
        ? [initialLat, initialLon] 
        : [21.0285, 105.8542]; // Mặc định Hà Nội
    const zoom = initialLat && initialLon ? 13 : 8;

    const handleLocationSelect = (lat: number, lon: number) => {
        setMarkerPosition([lat, lon]);
        onLocationSelect(lat, lon);
    };

    return (
        <div className="w-full h-[300px] sm:h-[400px] rounded-lg border overflow-hidden relative">
            <MapContainer
                // @ts-expect-error
                center={center}
                zoom={zoom}
                zoomControl={false}
                className="w-full h-full"
                style={{ height: "100%", width: "100%", zIndex: 0 }}
            >
                <MapSizeFixer />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    // @ts-expect-error
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapClickHandler onLocationSelect={handleLocationSelect} />
                {markerPosition && (
                    <Marker position={markerPosition} />
                )}
            </MapContainer>
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm text-xs z-[1000] pointer-events-none">
                <p className="font-medium text-gray-700">Nhấp vào bản đồ để chọn vị trí</p>
            </div>
        </div>
    );
}

