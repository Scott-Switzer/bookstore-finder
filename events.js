const { cities } = window.bookloopPrototypeData;
const citySelect = document.querySelector("#event-city");
const eventList = document.querySelector("#event-listings");
const eventCount = document.querySelector("#event-count");
const dateInput = document.querySelector("#specific-date");
const dateChips = [...document.querySelectorAll(".date-chip")];

const today = new Date();
today.setHours(0, 0, 0, 0);

function dateAfter(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const sampleEvents = [
  { id: "sg-reading", city: "singapore", store: "The Paper Garden (sample)", neighborhood: "Tiong Bahru", title: "Pages After Hours: a neighborhood reading", kind: "Reading", daysFromNow: 2, time: "6:30 PM", emoji: "📖" },
  { id: "sg-club", city: "singapore", store: "Moonlit Pages (sample)", neighborhood: "Kampong Glam", title: "The Plot Thickens: book club night", kind: "Book club", daysFromNow: 8, time: "7:00 PM", emoji: "🗣️" },
  { id: "sg-storytime", city: "singapore", store: "Little Comet Books (sample)", neighborhood: "Bras Basah", title: "Little readers, big adventures", kind: "Storytime", daysFromNow: 15, time: "11:00 AM", emoji: "🧸" },
  { id: "ny-signing", city: "new-york", store: "Paper Moon Books (sample)", neighborhood: "East Village", title: "Meet the author: stories from the city", kind: "Author event", daysFromNow: 1, time: "6:00 PM", emoji: "✍️" },
  { id: "ny-zines", city: "new-york", store: "Orbit & Oak (sample)", neighborhood: "Brooklyn", title: "Tiny Press, Big Ideas: zine-making hangout", kind: "Workshop", daysFromNow: 6, time: "2:00 PM", emoji: "📰" },
  { id: "ny-club", city: "new-york", store: "The Story Nook (sample)", neighborhood: "Upper West Side", title: "A cozy Sunday story circle", kind: "Book club", daysFromNow: 12, time: "4:00 PM", emoji: "☕" },
  { id: "chi-reading", city: "chicago", store: "North Star Books (sample)", neighborhood: "Andersonville", title: "Local voices: an open-mic reading", kind: "Reading", daysFromNow: 3, time: "7:00 PM", emoji: "🎤" },
  { id: "chi-club", city: "chicago", store: "Softcover Social (sample)", neighborhood: "Wicker Park", title: "Read it, loved it, pass it on", kind: "Book club", daysFromNow: 9, time: "6:30 PM", emoji: "💬" },
  { id: "chi-signing", city: "chicago", store: "Sunbeam Storyshop (sample)", neighborhood: "Logan Square", title: "Picture books & doodles with a local illustrator", kind: "Family event", daysFromNow: 18, time: "10:30 AM", emoji: "🎨" },
].map((event) => ({ ...event, date: dateAfter(event.daysFromNow) }));

let activeRange = "all";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function dateLabel(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function rangeEndDate(range) {
  if (range === "all") return null;
  if (range === "30") {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return end < today ? today : end;
  }
  const end = new Date(today);
  end.setDate(end.getDate() + Number(range));
  return end;
}

function filteredEvents() {
  const selectedCity = citySelect.value;
  const selectedDate = dateInput.value;
  const endDate = rangeEndDate(activeRange);

  return sampleEvents
    .filter((event) => selectedCity === "all" || event.city === selectedCity)
    .filter((event) => {
      if (selectedDate) return dateKey(event.date) === selectedDate;
      return !endDate || event.date <= endDate;
    })
    .sort((a, b) => a.date - b.date);
}

function renderEvents() {
  const events = filteredEvents();
  eventCount.textContent = `${events.length} sample event${events.length === 1 ? "" : "s"}`;
  eventList.replaceChildren();

  if (events.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "event-empty";
    emptyState.innerHTML = "<span aria-hidden=\"true\">📚</span><h3>No sample events on that day</h3><p>Try another date or switch to a wider date range.</p>";
    eventList.append(emptyState);
    return;
  }

  for (const event of events) {
    const card = document.createElement("article");
    card.className = "event-card";
    const city = cities[event.city];
    card.innerHTML = `
      <div class="event-date-tile"><span>${escapeHtml(dateLabel(event.date))}</span><strong>${escapeHtml(event.time)}</strong></div>
      <div class="event-card-copy">
        <div class="event-card-meta"><span class="event-kind">${event.emoji} ${escapeHtml(event.kind)}</span><span class="sample-stamp">SAMPLE</span></div>
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-venue">${escapeHtml(event.store)} <span>·</span> ${escapeHtml(event.neighborhood)}, ${escapeHtml(city.name)}</p>
      </div>
      <span class="event-card-arrow" aria-hidden="true">↗</span>`;
    eventList.append(card);
  }
}

function setRange(range) {
  activeRange = range;
  dateInput.value = "";
  dateChips.forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.range === range));
  });
  renderEvents();
}

dateChips.forEach((chip) => {
  chip.addEventListener("click", () => setRange(chip.dataset.range));
});

citySelect.addEventListener("change", renderEvents);
dateInput.addEventListener("change", () => {
  if (!dateInput.value) {
    setRange("all");
    return;
  }
  activeRange = "all";
  dateChips.forEach((chip) => chip.setAttribute("aria-pressed", "false"));
  renderEvents();
});

dateInput.min = dateKey(today);
renderEvents();
