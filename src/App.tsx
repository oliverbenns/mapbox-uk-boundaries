import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) {
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current as HTMLElement,
      accessToken: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-3.4735, 54.1171],
      zoom: 4,
      projection: {
        name: "mercator",
      },
    });

    (async () => {
      const res = await fetch("./boundaries.geojson");
      const data = await res.json();
      console.log("data", data);
    })();
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
