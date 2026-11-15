const cities = {
  singapore: {
    name: "Singapore",
    center: [1.3521, 103.8198],
    radius: 25000,
    zoom: 11,
  },
  "new-york": {
    name: "New York City",
    center: [40.7128, -74.006],
    radius: 35000,
    zoom: 10,
  },
  chicago: {
    name: "Chicago",
    center: [41.8781, -87.6298],
    radius: 30000,
    zoom: 10,
  },
};

const overpassEndpoint = "https://overpass-api.de/api/interpreter";
const cityButtons = [...document.querySelectorAll(".city-card")];
const explorer = document.querySelector("#explorer");
const explorerTitle = document.querySelector("#explorer-title");
const statusMessage = document.querySelector("#status");
const resultsCount = document.querySelector("#results-count");
const storeList = document.querySelector("#store-list");
const searchInput = document.querySelector("#search");
const changeCityButton = document.querySelector("#change-city");

let map;
let markersLayer;
let requestController;
let requestSequence = 0;
let activeCity;
let stores = [];

function getMap() {
  if (!map) {
    map = L.map("map", { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markersLayer = L.featureGroup().addTo(map);
  }
  return map;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function locationFor(element) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lon = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return [lat, lon];
}

function addressFor(tags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [street, tags["addr:suburb"] || tags["addr:city"] || tags["addr:place"]]
    .filter(Boolean)
    .join(", ");
}

function normalizeStore(element) {
  const tags = element.tags || {};
  const location = locationFor(element);
  if (!location || !tags.name) return null;

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name,
    address: addressFor(tags),
    website: tags.website || tags["contact:website"],
    location,
  };
}

function renderStores() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleStores = stores.filter((store) =>
    `${store.name} ${store.address}`.toLocaleLowerCase().includes(query),
  );

  resultsCount.textContent = query
    ? `${visibleStores.length} of ${stores.length} bookshops`
    : `${stores.length} bookshop${stores.length === 1 ? "" : "s"} found`;
  storeList.replaceChildren();

  for (const store of visibleStores) {
    const item = document.createElement("li");
    item.className = "store-item";

    const button = document.createElement("button");
    button.className = "store-button";
    button.type = "button";
    button.dataset.storeId = store.id;
    button.innerHTML = `<span class="store-name">${escapeHtml(store.name)}</span><span class="store-address">${escapeHtml(store.address || "Address not listed")}</span>`;
    button.addEventListener("click", () => focusStore(store));
    item.append(button);

    if (store.website && isHttpUrl(store.website)) {
      const link = document.createElement("a");
      link.className = "store-link";
      link.href = store.website;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Visit website ↗";
      item.append(link);
    }
    storeList.append(item);
  }

  markersLayer.clearLayers();
  for (const store of visibleStores) {
    const marker = L.circleMarker(store.location, {
      radius: 7,
      color: "#fff9ee",
      weight: 2,
      fillColor: "#ff654d",
      fillOpacity: 1,
    });
    marker.bindPopup(popupFor(store));
    marker.on("click", () => selectStore(store.id));
    marker.addTo(markersLayer);
  }
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function popupFor(store) {
  const address = store.address
    ? `<div>${escapeHtml(store.address)}</div>`
    : "";
  const website = store.website && isHttpUrl(store.website)
    ? `<a href="${escapeHtml(store.website)}" target="_blank" rel="noreferrer">Visit website ↗</a>`
    : "";
  return `<div><p class="popup-title">${escapeHtml(store.name)}</p>${address}${website}</div>`;
}

function selectStore(storeId) {
  document.querySelectorAll(".store-button").forEach((button) => {
    if (button.dataset.storeId === storeId) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function focusStore(store) {
  getMap().setView(store.location, 16);
  selectStore(store.id);
  markersLayer.eachLayer((marker) => {
    if (marker.getLatLng().equals(L.latLng(store.location))) marker.openPopup();
  });
}

function queryFor(city) {
  const [lat, lon] = city.center;
  const search = (type) => `${type}["shop"="books"](around:${city.radius},${lat},${lon});`;
  return `[out:json][timeout:25];(${search("node")}${search("way")}${search("relation")});out center tags;`;
}

async function loadCity(cityId) {
  const city = cities[cityId];
  if (!city) return;

  activeCity = cityId;
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const currentRequest = ++requestSequence;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30000);
  explorer.hidden = false;
  explorerTitle.textContent = `Bookshops in ${city.name}`;
  statusMessage.textContent = `Finding your bookshop stops in ${city.name}…`;
  resultsCount.textContent = "Loading bookshops";
  searchInput.disabled = true;
  searchInput.value = "";
  storeList.replaceChildren();
  getMap().setView(city.center, city.zoom);
  markersLayer.clearLayers();
  document.querySelector("#explorer").scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch(overpassEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data: queryFor(city) }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Bookshop data service returned ${response.status}`);

    const data = await response.json();
    if (currentRequest !== requestSequence) return;
    stores = (data.elements || [])
      .map(normalizeStore)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    searchInput.disabled = false;

    if (stores.length === 0) {
      statusMessage.textContent = "No named bookshops were found in this area. The map may be missing listings.";
    } else {
      statusMessage.textContent = "";
    }
    renderStores();

    if (markersLayer.getLayers().length > 0) {
      getMap().fitBounds(markersLayer.getBounds().pad(0.12), { maxZoom: 14 });
    }
  } catch (error) {
    if (currentRequest !== requestSequence) return;

    stores = [];
    searchInput.disabled = true;
    resultsCount.textContent = "Bookshops unavailable";
    statusMessage.textContent = timedOut
      ? "This search is taking longer than usual. Tap the city to try again."
      : "The bookshop map is taking a breather. Tap the city to try again in a moment.";
    console.error("Could not load OpenStreetMap bookshop data:", error);
  } finally {
    clearTimeout(timeoutId);
  }
}

cityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cityButtons.forEach((cityButton) => {
      cityButton.setAttribute("aria-pressed", String(cityButton === button));
    });
    loadCity(button.dataset.city);
  });
});

searchInput.addEventListener("input", renderStores);

changeCityButton.addEventListener("click", () => {
  requestController?.abort();
  requestSequence += 1;
  activeCity = undefined;
  explorer.hidden = true;
  cityButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  document.querySelector(".city-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("resize", () => {
  if (activeCity && map) map.invalidateSize();
});
