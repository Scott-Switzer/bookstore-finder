const { cities, categories, stores } = window.bookloopPrototypeData;
const cityButtons = [...document.querySelectorAll(".city-card")];
const explorer = document.querySelector("#explorer");
const explorerTitle = document.querySelector("#explorer-title");
const statusMessage = document.querySelector("#status");
const resultsCount = document.querySelector("#results-count");
const storeList = document.querySelector("#store-list");
const searchInput = document.querySelector("#search");
const changeCityButton = document.querySelector("#change-city");
const clearFiltersButton = document.querySelector("#clear-filters");
const categoryTabs = [...document.querySelectorAll(".vibe-tab")];
const vibeOptions = document.querySelector("#vibe-options");
const selectedVibes = document.querySelector("#selected-vibes");

const selectedTags = new Map(Object.keys(categories).map((category) => [category, new Set()]));
let activeCategory = "selection";
let activeCity;
let map;
let markersLayer;

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

function tagsFor(store) {
  return Object.values(store.tags).flat();
}

function matchingStores() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const chosenCategories = [...selectedTags.entries()].filter(([, values]) => values.size > 0);

  return stores.filter((store) => {
    if (store.city !== activeCity) return false;
    if (query && !`${store.name} ${store.address} ${store.neighborhood}`.toLocaleLowerCase().includes(query)) {
      return false;
    }

    return chosenCategories.every(([category, selected]) =>
      [...selected].some((tag) => store.tags[category].includes(tag)),
    );
  });
}

function renderTagPills(store) {
  return tagsFor(store)
    .slice(0, 3)
    .map((tagId) => {
      const tag = Object.values(categories).flat().find((item) => item.id === tagId);
      return tag ? `<span class="store-tag">${tag.emoji} ${escapeHtml(tag.label)}</span>` : "";
    })
    .join("");
}

function renderStores() {
  if (!activeCity) return;

  const visibleStores = matchingStores();
  const cityStores = stores.filter((store) => store.city === activeCity);
  const hasFilters = searchInput.value.trim() || [...selectedTags.values()].some((values) => values.size);
  resultsCount.textContent = hasFilters
    ? `${visibleStores.length} of ${cityStores.length} sample bookshops`
    : `${cityStores.length} sample bookshops to explore`;
  statusMessage.textContent = visibleStores.length
    ? "Demo matches only — sample shops and vibe tags aren’t real listings."
    : "No sample shops match those vibes. Try another combo or clear your filters.";
  storeList.replaceChildren();

  for (const store of visibleStores) {
    const item = document.createElement("li");
    item.className = "store-item";

    const button = document.createElement("button");
    button.className = "store-button";
    button.type = "button";
    button.dataset.storeId = store.id;
    button.innerHTML = `
      <span class="store-card-heading"><span class="store-name">${escapeHtml(store.name)}</span><span class="sample-stamp">SAMPLE</span></span>
      <span class="store-address">${escapeHtml(store.neighborhood)} · sample neighborhood</span>
      <span class="store-tags">${renderTagPills(store)}</span>`;
    button.addEventListener("click", () => focusStore(store));
    item.append(button);
    storeList.append(item);
  }

  markersLayer.clearLayers();
  for (const store of visibleStores) {
    const marker = L.circleMarker(store.location, {
      radius: 9,
      color: "#fff9ee",
      weight: 3,
      fillColor: "#ff654d",
      fillOpacity: 1,
    });
    marker.bindPopup(popupFor(store));
    marker.on("click", () => selectStore(store.id));
    marker.addTo(markersLayer);
  }

  if (visibleStores.length > 1) {
    getMap().fitBounds(markersLayer.getBounds().pad(0.18), { maxZoom: 14 });
  } else if (visibleStores.length === 1) {
    getMap().setView(visibleStores[0].location, 15);
  } else {
    getMap().setView(cities[activeCity].center, cities[activeCity].zoom);
  }
}

function popupFor(store) {
  const tags = tagsFor(store)
    .slice(0, 4)
    .map((tagId) => {
      const tag = Object.values(categories).flat().find((item) => item.id === tagId);
      return tag ? `<span class="popup-tag">${tag.emoji} ${escapeHtml(tag.label)}</span>` : "";
    })
    .join("");
  return `
    <div class="store-popup">
      <span class="sample-stamp">SAMPLE LISTING</span>
      <p class="popup-title">${escapeHtml(store.name)}</p>
      <div>${escapeHtml(store.neighborhood)} · fictional demo location</div>
      <div class="popup-tags">${tags}</div>
    </div>`;
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

function renderVibeOptions() {
  vibeOptions.replaceChildren();
  vibeOptions.setAttribute("aria-labelledby", `tab-${activeCategory}`);
  for (const tag of categories[activeCategory]) {
    const button = document.createElement("button");
    const selected = selectedTags.get(activeCategory).has(tag.id);
    button.className = "vibe-chip";
    button.type = "button";
    button.dataset.tag = tag.id;
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `<span aria-hidden="true">${tag.emoji}</span> ${escapeHtml(tag.label)}<span class="chip-check" aria-hidden="true">${selected ? "✓" : "+"}</span>`;
    button.addEventListener("click", () => {
      const values = selectedTags.get(activeCategory);
      if (values.has(tag.id)) values.delete(tag.id);
      else values.add(tag.id);
      renderVibeOptions();
      renderSelectedVibes();
      renderStores();
    });
    vibeOptions.append(button);
  }
}

function renderSelectedVibes() {
  selectedVibes.replaceChildren();
  const selections = [];
  for (const [category, values] of selectedTags) {
    for (const tagId of values) {
      const tag = categories[category].find((item) => item.id === tagId);
      if (tag) selections.push({ category, tag });
    }
  }

  if (selections.length === 0) {
    const prompt = document.createElement("span");
    prompt.className = "selected-prompt";
    prompt.textContent = "Your picks will show up here";
    selectedVibes.append(prompt);
    return;
  }

  for (const { category, tag } of selections) {
    const chip = document.createElement("button");
    chip.className = "selected-chip";
    chip.type = "button";
    chip.setAttribute("aria-label", `Remove ${tag.label} filter`);
    chip.innerHTML = `${tag.emoji} ${escapeHtml(tag.label)} <span aria-hidden="true">×</span>`;
    chip.addEventListener("click", () => {
      selectedTags.get(category).delete(tag.id);
      renderVibeOptions();
      renderSelectedVibes();
      renderStores();
    });
    selectedVibes.append(chip);
  }
}

function setActiveCategory(category) {
  activeCategory = category;
  for (const tab of categoryTabs) {
    const selected = tab.dataset.category === category;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  renderVibeOptions();
}

function loadCity(cityId) {
  const city = cities[cityId];
  if (!city) return;

  activeCity = cityId;
  for (const values of selectedTags.values()) values.clear();
  searchInput.value = "";
  searchInput.disabled = false;
  explorer.hidden = false;
  explorerTitle.textContent = `Bookshops in ${city.name}`;
  statusMessage.textContent = "";
  resultsCount.textContent = "Finding sample bookshops…";
  cityButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.city === cityId));
  });

  setActiveCategory("selection");
  renderSelectedVibes();
  getMap().setView(city.center, city.zoom);
  markersLayer.clearLayers();
  renderStores();
  explorer.scrollIntoView({ behavior: "smooth", block: "start" });
}

cityButtons.forEach((button) => {
  button.addEventListener("click", () => loadCity(button.dataset.city));
});

categoryTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => setActiveCategory(tab.dataset.category));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? categoryTabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + categoryTabs.length) % categoryTabs.length;
    categoryTabs[nextIndex].focus();
    setActiveCategory(categoryTabs[nextIndex].dataset.category);
  });
});

searchInput.addEventListener("input", renderStores);

clearFiltersButton.addEventListener("click", () => {
  for (const values of selectedTags.values()) values.clear();
  searchInput.value = "";
  renderVibeOptions();
  renderSelectedVibes();
  renderStores();
});

changeCityButton.addEventListener("click", () => {
  activeCity = undefined;
  explorer.hidden = true;
  markersLayer.clearLayers();
  for (const values of selectedTags.values()) values.clear();
  searchInput.value = "";
  searchInput.disabled = true;
  cityButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  document.querySelector(".city-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("resize", () => {
  if (activeCity && map) map.invalidateSize();
});

renderVibeOptions();
renderSelectedVibes();
