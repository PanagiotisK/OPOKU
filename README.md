# Opoku

**Opoku** is a standalone, browser-based map experience. It draws real driving routes over a restrained, hand-drawn-feeling map, animates a glowing aura along each route, and can continuously create sample journeys around a configurable city.

The project has no application backend and requires no API key. The browser loads the map, search results, and routes from the public services described below. Those services provide the real-world map data; Opoku supplies the styling, route simulation, controls, and city configuration.

## Run it locally

The site is buildless HTML, CSS, and JavaScript. It needs a small local HTTP server because browsers generally do not load vector map resources correctly from a `file://` URL.

From the project root, run either command:

```bash
python -m http.server 8000 --directory dist
```

On Windows, if `python` is not on PATH:

```powershell
py -m http.server 8000 --directory dist
```

Then open <http://localhost:8000>. An internet connection is required. There is no npm install or build step.

## Choose and configure a city

Use the **City** selector in the planner to switch cities. The browser title and brand update to **Opoku x [City]**. The selected city is stored in the URL (for example, `?city=berlin`), so city links can be shared. Athens is the default when no city is specified and the fallback if another city's configuration cannot be loaded.

Each city has its own configuration file using the `city-config-[city].js` naming pattern. **`dist/city-config-athens.js`** is Athens and the default/fallback; the other files are `dist/city-config-thessaloniki.js`, `dist/city-config-berlin.js`, `dist/city-config-london.js`, and `dist/city-config-barcelona.js`. **`dist/city-loader.js`** maps the selector and URL slugs to those files. Each config includes an IANA `timeZone` so automatic mood selection follows the selected city's clock and daylight-saving rules. The loader also supplies the known city time zone and warns in the console if an older config is missing it.

Edit a city's configuration to change its name, starting map position, zoom, route interval, minimum trip length, and route anchors:

```js
window.OPOKU_CONFIG = {
  city: {
    name: 'Athens',
    timeZone: 'Europe/Athens',
    center: [23.7275, 37.9838], // [longitude, latitude]
    zoom: 15.7,
    routeIntervalMs: 12000,
    minimumRouteDistanceMeters: 2500,
    places: [
      ['Syntagma', [23.7353, 37.9755]],
      ['Koukaki', [23.7250, 37.9630]]
    ]
  }
};
```

To use another city or country:

1. Set `name` to the city name shown in the interface.
2. Change `center` to the map's initial `[longitude, latitude]` and choose a suitable `zoom`.
3. Replace `places` with named coordinate anchors distributed across the city or region. Use longitude first, latitude second. A handful of anchors across different neighborhoods creates varied trips; 10–20 is a useful starting range.
4. Adjust `minimumRouteDistanceMeters` to match the size of the area. Reduce it for a compact city; increase it for a large metro area.
5. Set `routeIntervalMs` to control how often Opoku requests a new route. The project caps the map at five active routes, and the public routing server is called through a rate-limited queue.

The initial view, **Show city** button, local-search bias fallback, and automatic-route sampler all read this configuration. Manual place search and driving routes can still use locations anywhere the public services cover. A custom location selected from the map is also sent to the public routing service.

Automatic route endpoints are chosen from pairs in `places`, then the router snaps them to nearby drivable roads. Use points near streets and connected road networks. If a pair cannot be routed, the demo waits and tries another pair later. To cover a whole country, provide anchors over a smaller regional area or increase the minimum distance; for continuous routes across a large country, split it into several regional configurations. The route source's coverage and public-service limits still apply.

## Controls

- Search for a start and destination, then choose one of the suggestions; or use the map-pick buttons.
- The panels and map controls are hidden at startup. Use the header toggle to show them.
- Choose Athens, Thessaloniki, Berlin, London, or Barcelona from the City selector.
- The Mood selector follows the selected city's local sunrise and sunset by default: Blue hour runs within one hour before and after each, Golden hour covers the remaining daylight, and After dark covers the rest of the night. Turn off **Use city local time** to choose a mood manually; the mood URL parameter makes that look shareable.
- Select an active journey chip to control a route. Play, pause, restart, adjust the shared simulation speed, or follow its marker.
- The camera follows the first automatic journey by default. In Follow mode, it tilts and anticipates turns based on playback speed; Overview returns to a top-down view.
- **Athens, alive** enables or disables automatic sample journeys. There are at most five active journeys at once.
- The Drawing Layers panel has independent visibility switches. Roads, route lines, and endpoint markers start hidden; turn them on when useful.
- **Hide panels** clears the interface panels from the map. The toggle remains available at the upper right.
- When a journey ends, its line, aura, and endpoint markers are removed. If the camera was following it, the camera smoothly follows the newest active journey.

## Technology

| Part | Technology | Role |
|---|---|---|
| User interface | HTML5, CSS, plain JavaScript | Panels, responsive layout, search suggestions, controls, simulation, and route cleanup. |
| Interactive map | MapLibre GL JS 5.6.2 | WebGL map rendering, vector styles, geographic camera, and GeoJSON route layers. Loaded from unpkg CDN. |
| Basemap and tiles | OpenFreeMap Liberty style; OpenMapTiles schema; OpenStreetMap data | Global vector basemap and the road, building, park, water, and place features styled by Opoku. |
| Place/address search | Photon public API by Komoot | Worldwide forward geocoding and suggestion results, based on OpenStreetMap data. |
| Driving routes | OSRM car profile hosted by FOSSGIS at routing.openstreetmap.de | Road-following route geometry and estimated distance and time. Route durations are router estimates, not live traffic. |
| Fonts | DM Sans and Libre Baskerville from Google Fonts | Interface and editorial display type. System fallbacks are specified. |

Opoku is buildless: it has no framework, package manager, database, server application, or map-provider API key. The application files are `dist/index.html`, `dist/style.css`, `dist/app.js`, `dist/moods.js`, `dist/city-loader.js`, and the city-specific `dist/city-config*.js` files (plus this README and the small `package.json` metadata file).

For lower-power devices such as TV browsers, the map's WebGL pixel ratio is capped at 1.5, the paper-grain overlay starts disabled, journey animation is capped at 30 FPS, and its update loop stops when no trip is moving or the page is hidden.

## Third-party services, data, and limits

- **OpenFreeMap** serves the style and vector map tiles without an account or API key. Map tiles are third-party network requests from the browser.
- **OpenStreetMap** is the underlying collaborative map database. The page displays attribution and a link to report/fix map data. OSM data is available under the Open Database License (ODbL); attribution and share-alike conditions apply to derived databases.
- **Photon** geocodes searches. Opoku debounces typing, limits suggestions, deduplicates visible results, and rate-limits requests. Photon’s public Komoot-hosted server asks applications to keep usage reasonable; it is a demo service and may throttle or change availability.
- **FOSSGIS OSRM** calculates driving routes. Opoku sends no more than about one routing request per second through its shared request queue. The server’s published policy asks for no more than one request per second and prohibits scraping or heavy use. The sample generator waits when full, runs only while the page is visible, and is designed for a light prototype/demo rather than high-volume production traffic.
- **Google Fonts** and **unpkg** serve the fonts and MapLibre browser library. If unavailable, the map or fonts may not load; system font fallbacks are included.

A route request includes its selected coordinates and is processed by the routing host. A search request includes the typed search phrase and, in **Near this map** mode, a map-center location bias. No Opoku backend stores searches or routes. The selected public providers apply their own logging and privacy practices; review their current policies before using the app for sensitive destinations or production workloads.

The map shows OSM attribution and credits the tile/style and route providers in the interface. Keep those credits visible when adapting the app. See the [OpenStreetMap copyright and licensing terms](https://www.openstreetmap.org/copyright), [Photon project and demo-server guidance](https://github.com/komoot/photon#demo-server), and [FOSSGIS routing-server usage policy](https://routing.openstreetmap.de/about.html#usage-policy). Public demo services can change, become unavailable, throttle requests, or impose updated terms. For a larger deployment, use a hosted/self-hosted provider with terms and capacity suited to the expected traffic, while keeping the APIs configurable in `dist/app.js`.

## Project files

```text
opoku/
├── package.json
├── README.md
└── dist/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── moods.js
    ├── city-loader.js
    ├── city-config-athens.js
    ├── city-config-thessaloniki.js
    ├── city-config-berlin.js
    ├── city-config-london.js
    └── city-config-barcelona.js
```

`package.json` is metadata only; the application runs directly from the static files.
