import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import proj4 from "proj4";
import { FeatureCollection, Polygon } from "geojson";

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

    map.current.on("load", () => {
      (async () => {
        const res = await fetch("./boundaries.geojson");
        const data = (await res.json()) as FeatureCollection<Polygon>;
        console.log("data", data);

        // Data is in EPSG:27700 (British National Grid) format and Mapbox requires it in EPSG:4326.
        normalizeData(data);

        if (!map.current) {
          throw new Error("could not get map ref");
        }

        map.current.addSource("boundaries", {
          type: "geojson",
          data: data,
        });

        // Add a new layer to visualize the polygon.
        map.current.addLayer({
          id: "boundaries_fill",
          type: "fill",
          source: "boundaries", // reference the data source
          layout: {},
          paint: {
            "fill-color": "#0080ff", // blue color fill
            "fill-opacity": 0.5,
          },
        });

        // Add a black outline around the polygon.
        map.current.addLayer({
          id: "boundaries_line",
          type: "line",
          source: "boundaries",
          layout: {},
          paint: {
            "line-color": "#000",
            "line-width": 3,
          },
        });
      })();
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

// Converts polygon boundary coordinates from EPSG:27700 to EPSG:4326.
// NOTE: This mutates!!
const normalizeData = (data: FeatureCollection<Polygon>) => {
  proj4.defs(
    "EPSG:27700",
    "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs"
  );

  // Delete the crs header (not sure why untyped) that states EPSG:27700
  // incase Mapbox decides to respect this later.
  delete (data as any).crs;

  data.features.forEach((feature, i) => {
    feature.geometry.coordinates.forEach((coord, j) => {
      coord.forEach((pos, k) => {
        // safety
        if (pos.length === 0) {
          return;
        }

        // Pos is typed as number[] but sometimes it's number[][].
        // It looks like this could come from an old Geojson spec.
        const isLegacyGeoJson = Array.isArray(pos[0]);
        if (isLegacyGeoJson) {
          pos.forEach((innerPos, l) => {
            const newVal = proj4(
              "EPSG:27700",
              "EPSG:4326",
              innerPos as never as number[]
            );

            (data.features[i].geometry.coordinates[j][k][
              l
            ] as never as number[]) = newVal;
          });
          return;
        }
        const newVal = proj4("EPSG:27700", "EPSG:4326", pos);

        data.features[i].geometry.coordinates[j][k] = newVal;
      });
    });
  });
};

export default App;
