import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import proj4 from "proj4";
import { FeatureCollection, Polygon } from "geojson";

// https://github.com/visgl/react-map-gl/issues/1266
// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax
import MapboxWorker from "worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker";

// @ts-ignore
mapboxgl.workerClass = MapboxWorker;

interface CountyProperties {
  GlobalID: string;
  OBJECTID: number;
  bng_e: number;
  bng_n: number;
  ctyua19cd: string;
  ctyua19nm: string;
  ctyua19nmw: string;
  lat: number;
  long: number;
}

type BoundaryData = FeatureCollection<Polygon, CountyProperties>;

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
      style: "mapbox://styles/mapbox/light-v11",
      center: [-3.4735, 54.1171],
      zoom: 4,
      projection: {
        name: "mercator",
      },
    });

    map.current.on("load", () => {
      if (!map.current) {
        throw new Error("could not get map ref");
      }

      removeLabels(map.current);

      (async () => {
        const res = await fetch(`${process.env.PUBLIC_URL}/boundaries.geojson`);
        const data = (await res.json()) as BoundaryData;
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

        addLayers(map.current);
        addHoverListeners(map.current);
      })();
    });
  });

  return (
    <div>
      <header>
        <h1>Mapbox UK Boundaries</h1>
        <a
          href="https://github.com/oliverbenns/mapbox-uk-boundaries"
          target="_blank"
          rel="noreferrer"
        >
          View on Github
        </a>
      </header>
      <main>
        <div ref={mapContainer} className="map" />
      </main>
    </div>
  );
}

// Remove programmatically so no need to create a new style in mapbox studio.
// Does result in flash though on initial load.
const removeLabels = (map: mapboxgl.Map) => {
  map.getStyle().layers.forEach((l) => {
    if (l.type === "symbol") {
      map.setLayoutProperty(l.id, "visibility", "none");
    }
  });
};

const addLayers = (map: mapboxgl.Map) => {
  map.addLayer({
    id: "boundaries-fill",
    type: "fill",
    source: "boundaries",
    layout: {},
    paint: {
      "fill-color": "#0080ff",
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.5,
      ],
    },
  });

  map.addLayer({
    id: "boundaries-line",
    type: "line",
    source: "boundaries",
    layout: {},
    paint: {
      "line-color": "#000",
      "line-width": 1,
    },
  });
};

const addHoverListeners = (map: mapboxgl.Map) => {
  let hoveredFeatureId: string | number | undefined;
  const popup = new mapboxgl.Popup({
    offset: [0, -8],
    closeButton: false,
    closeOnClick: false,
  });

  map.on("mousemove", "boundaries-fill", (ev) => {
    if (hoveredFeatureId !== undefined) {
      map.setFeatureState(
        { source: "boundaries", id: hoveredFeatureId },
        { hover: false }
      );
    }

    if (!ev.features || ev.features.length === 0) {
      return;
    }

    const feature = ev.features[0];
    const properties = feature.properties as CountyProperties;
    const countyName = properties.ctyua19nm;

    popup
      .setLngLat(ev.lngLat)
      .setHTML("<span>" + countyName + "</span>")
      .addTo(map);

    hoveredFeatureId = feature.id;
    map.setFeatureState(
      { source: "boundaries", id: hoveredFeatureId },
      { hover: true }
    );
  });

  map.on("mouseleave", "boundaries-fill", () => {
    popup.remove();

    if (hoveredFeatureId !== undefined) {
      map.setFeatureState(
        { source: "boundaries", id: hoveredFeatureId },
        { hover: false }
      );
    }
    hoveredFeatureId = undefined;
  });
};

// Converts polygon boundary coordinates from EPSG:27700 to EPSG:4326.
// NOTE: This mutates!!
const normalizeData = (data: BoundaryData) => {
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
