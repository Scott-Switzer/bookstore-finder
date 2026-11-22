import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../src/event-feed.js";

const FEED_URL = "https://example-books.com/events/";

function page(events) {
  return `<!doctype html><html><head><script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: events,
})}
</script></head><body><h1>Events</h1></body></html>`;
}

test("keeps every event when a calendar shares one page URL across listings", () => {
  const html = page([
    {
      "@type": "Event",
      name: "Author Talk: Ada Limon",
      startDate: "2026-12-05T19:00:00-05:00",
      url: FEED_URL,
    },
    {
      "@type": "Event",
      name: "Saturday Storytime",
      startDate: "2026-12-06T10:30:00-05:00",
      url: FEED_URL,
    },
    {
      "@type": "Event",
      name: "Signed First Editions Book Club",
      startDate: "2026-12-09T18:00:00-05:00",
      url: FEED_URL,
    },
  ]);

  const { format, events } = parseFeed(html, { url: FEED_URL });

  assert.equal(format, "jsonld");
  assert.deepEqual(
    events.map((event) => event.title),
    ["Author Talk: Ada Limon", "Saturday Storytime", "Signed First Editions Book Club"],
  );
  assert.equal(new Set(events.map((event) => event.uid)).size, 3);
  assert.ok(
    events.every((event) => event.uid !== FEED_URL),
    "a shared calendar URL must not become the event identity",
  );
});

test("event identity is stable across repeated parses of a shared-URL calendar", () => {
  const html = page([
    { "@type": "Event", name: "Poetry Night", startDate: "2026-12-05T19:00:00-05:00", url: FEED_URL },
    { "@type": "Event", name: "Kids Storytime", startDate: "2026-12-06T10:30:00-05:00", url: FEED_URL },
  ]);

  const first = parseFeed(html, { url: FEED_URL }).events.map((event) => event.uid);
  const second = parseFeed(html, { url: FEED_URL }).events.map((event) => event.uid);

  assert.deepEqual(first, second);
});

test("a shared @id on the calendar page does not collapse distinct events", () => {
  const html = page([
    {
      "@type": "Event",
      "@id": "https://example-books.com/events/#calendar",
      name: "Cookbook Club",
      startDate: "2026-12-12T12:00:00-05:00",
    },
    {
      "@type": "Event",
      "@id": "https://example-books.com/events/#calendar",
      name: "Mystery Book Club",
      startDate: "2026-12-14T18:30:00-05:00",
    },
  ]);

  const { events } = parseFeed(html, { url: FEED_URL });

  assert.equal(events.length, 2);
  assert.equal(new Set(events.map((event) => event.uid)).size, 2);
});

test("prefers a per-event identifier over the shared page URL", () => {
  const html = page([
    {
      "@type": "Event",
      name: "Launch Party",
      startDate: "2026-12-18T19:00:00-05:00",
      identifier: { "@type": "PropertyValue", value: "evt-8841" },
      url: FEED_URL,
    },
    {
      "@type": "Event",
      name: "Staff Picks Readalike Night",
      startDate: "2026-12-19T19:00:00-05:00",
      identifier: "evt-8842",
      url: FEED_URL,
    },
  ]);

  const { events } = parseFeed(html, { url: FEED_URL });

  assert.deepEqual(
    events.map((event) => event.uid),
    ["evt-8841", "evt-8842"],
  );
});

test("uses a genuinely per-event URL as the identifier", () => {
  const html = page([
    {
      "@type": "Event",
      name: "Signed Saturday",
      startDate: "2026-12-20T13:00:00-05:00",
      url: "https://example-books.com/events/signed-saturday/",
    },
    {
      "@type": "Event",
      name: "Writers Workshop",
      startDate: "2026-12-21T18:00:00-05:00",
      url: "https://example-books.com/events/writers-workshop/",
    },
  ]);

  const { events } = parseFeed(html, { url: FEED_URL });

  assert.deepEqual(
    events.map((event) => event.uid),
    [
      "https://example-books.com/events/signed-saturday/",
      "https://example-books.com/events/writers-workshop/",
    ],
  );
});

test("collapses an exact repeat of the same listing", () => {
  const listing = {
    "@type": "Event",
    name: "Holiday Open House",
    startDate: "2026-12-22T17:00:00-05:00",
    url: FEED_URL,
  };
  const { events } = parseFeed(page([listing, { ...listing }]), { url: FEED_URL });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Holiday Open House");
});

test("still deduplicates by ICS UID", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Example Books//Events//EN",
    "BEGIN:VEVENT",
    "UID:shop-1001@example-books.com",
    "SUMMARY:Author Talk",
    "DTSTART:20261205T190000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const { format, events } = parseFeed(ics, { url: "https://example-books.com/events.ics" });

  assert.equal(format, "ics");
  assert.equal(events.length, 1);
  assert.equal(events[0].uid, "shop-1001@example-books.com");
});
