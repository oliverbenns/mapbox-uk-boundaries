import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);

  useEffect(() => {
    if (map.current) {
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current as HTMLElement,
      accessToken: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: zoom,
    });
  });

  return (
    <div>
      <main>
        <div ref={mapContainer} className="map" />
      </main>
    </div>
  );
}

export default App;
