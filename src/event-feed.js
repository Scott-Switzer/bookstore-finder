const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value) {
  return String(value ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const hex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) && number <= 0x10ffff ? String.fromCodePoint(number) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripHtml(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function guessEventKind(title) {
  const text = String(title || "").toLowerCase();
  if (text.includes("book club")) return "Book club";
  if (text.includes("storytime") || text.includes("story time")) return "Storytime";
  if (text.includes("signing")) return "Signing";
  if (text.includes("workshop")) return "Workshop";
  if (text.includes("launch")) return "Launch party";
  if (text.includes("reading") || text.includes("author")) return "Author event";
  return "Other";
}

function icsText(value) {
  return stripHtml(
    String(value ?? "")
      .replace(/\\n/gi, " ")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\"),
  );
}

function absoluteHttpUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(String(value), base || undefined);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- ics */

function timeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .filter((part) => part.type !== "literal")
    .reduce((all, part) => ({ ...all, [part.type]: part.value }), {});
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return wallClock - date.getTime();
}

function zonedTimeToUtc(year, month, day, hour, minute, second, timeZone) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    let result = wallClock - timeZoneOffset(new Date(wallClock), timeZone);
    // Re-check the offset at the resolved instant so DST boundaries settle.
    result = wallClock - timeZoneOffset(new Date(result), timeZone);
    return new Date(result);
  } catch {
    return new Date(wallClock);
  }
}

function parseIcsDate(line) {
  if (!line) return null;
  const raw = String(line).slice(String(line).indexOf(":") + 1).trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00", zulu] = match;
  const timeZone = /TZID=([^;:]+)/i.exec(String(line))?.[1]?.replace(/^["']|["']$/g, "") || null;
  const date =
    zulu || !timeZone
      ? new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second))
      : zonedTimeToUtc(+year, +month, +day, +hour, +minute, +second, timeZone);
  return { date, timezone: zulu || !timeZone ? "UTC" : timeZone };
}

function parseIcs(text, feedUrl) {
  const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
  const events = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const chunk = block.split("END:VEVENT")[0];
    const lines = chunk.split(/\r?\n/);
    const lineFor = (name) =>
      lines.find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`)) || null;
    const valueFor = (name) => {
      const line = lineFor(name);
      return line ? line.slice(line.indexOf(":") + 1).trim() : null;
    };

    if (String(valueFor("STATUS") || "").toUpperCase() === "CANCELLED") continue;
    const title = icsText(valueFor("SUMMARY"));
    const start = parseIcsDate(lineFor("DTSTART"));
    if (!title || !start?.date || Number.isNaN(start.date.getTime())) continue;
    const end = parseIcsDate(lineFor("DTEND"));
    const endsAt = end?.date && !Number.isNaN(end.date.getTime()) && end.date > start.date ? end.date : null;
    const uid = icsText(valueFor("UID")) || `${title}-${start.date.toISOString()}`;
    const description = icsText(valueFor("DESCRIPTION")).slice(0, 600) || null;
    const url = absoluteHttpUrl(valueFor("URL"), feedUrl) || feedUrl;

    events.push({
      uid,
      title: title.slice(0, 140),
      startsAt: start.date,
      endsAt,
      timezone: start.timezone,
      description,
      url,
    });
  }
  return events;
}

/* --------------------------------------------------------------- json-ld */

function collectEvents(node, found = []) {
  if (!node) return found;
  if (Array.isArray(node)) {
    for (const item of node) collectEvents(item, found);
    return found;
  }
  if (typeof node !== "object") return found;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.some((type) => typeof type === "string" && type.toLowerCase() === "event")) found.push(node);
  for (const key of ["@graph", "itemListElement", "item"]) {
    if (node[key]) collectEvents(node[key], found);
  }
  return found;
}

function jsonLdNodes(html) {
  const nodes = [];
  const trimmed = String(html || "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      nodes.push(JSON.parse(trimmed));
    } catch {
      // Fall through to embedded blocks.
    }
  }
  for (const match of String(html || "").matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      nodes.push(JSON.parse(match[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "")));
    } catch {
      // A malformed block should not hide the other event blocks on the page.
    }
  }
  return nodes;
}

function identifierText(identifier) {
  if (identifier === null || identifier === undefined) return null;
  if (typeof identifier === "string" || typeof identifier === "number") {
    return String(identifier).trim() || null;
  }
  if (Array.isArray(identifier)) {
    for (const item of identifier) {
      const value = identifierText(item);
      if (value) return value;
    }
    return null;
  }
  if (typeof identifier === "object") return identifierText(identifier.value);
  return null;
}

function parseJsonLd(html, feedUrl) {
  const found = [];
  for (const node of jsonLdNodes(html)) found.push(...collectEvents(node));

  // Many shops point every listing at the same calendar page, and some reuse a
  // single @id for the whole page. Those fields only name an event when they
  // are unique among the events on the page; otherwise every listing would
  // collapse into one identity and the rest would be dropped as duplicates.
  const seen = new Map();
  const note = (value) => {
    if (!value) return;
    const key = String(value).toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  };
  for (const event of found) {
    note(absoluteHttpUrl(event.url, feedUrl));
    if (typeof event["@id"] === "string") note(event["@id"].trim());
  }
  const isUnique = (value) => {
    if (!value) return false;
    const key = String(value).toLowerCase();
    return key !== String(feedUrl || "").toLowerCase() && seen.get(key) === 1;
  };

  const events = [];
  for (const event of found) {
    const title = stripHtml(event.name);
    const startsAt = event.startDate ? new Date(event.startDate) : null;
    if (!title || !startsAt || Number.isNaN(startsAt.getTime())) continue;
    if (String(event.eventStatus || "").toLowerCase().includes("cancel")) continue;
    const endsAt = event.endDate ? new Date(event.endDate) : null;
    const atId = typeof event["@id"] === "string" ? event["@id"].trim() : null;
    const url = absoluteHttpUrl(event.url, feedUrl);
    const uid =
      identifierText(event.identifier) ||
      (isUnique(atId) ? atId : null) ||
      (isUnique(url) ? url : null) ||
      `${title}-${startsAt.toISOString()}`;
    events.push({
      uid,
      title: title.slice(0, 140),
      startsAt,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) && endsAt > startsAt ? endsAt : null,
      timezone: "UTC",
      description: stripHtml(event.description).slice(0, 600) || null,
      url: url || feedUrl,
    });
  }
  return events;
}

/* ----------------------------------------------------------------- public */

export function detectFeedFormat(body, contentType = "") {
  const text = String(body || "").trimStart();
  return String(contentType).toLowerCase().includes("calendar") || text.startsWith("BEGIN:VCALENDAR")
    ? "ics"
    : "jsonld";
}

export function parseFeed(body, { url = "", format = "auto", contentType = "" } = {}) {
  const chosen = format === "ics" || format === "jsonld" ? format : detectFeedFormat(body, contentType);
  const events = chosen === "ics" ? parseIcs(body, url) : parseJsonLd(body, url);
  const deduped = new Map();
  for (const event of events) {
    if (!event?.uid) continue;
    let key = event.uid.toLowerCase();
    const existing = deduped.get(key);
    if (existing) {
      const sameListing =
        existing.title === event.title && existing.startsAt?.getTime() === event.startsAt?.getTime();
      // An exact repeat is the same listing. Different events that happen to
      // share an upstream identifier are numbered so neither is silently lost.
      if (sameListing) continue;
      let suffix = 2;
      while (deduped.has(`${key}#${suffix}`)) suffix += 1;
      event.uid = `${event.uid}#${suffix}`;
      key = `${key}#${suffix}`;
    }
    deduped.set(key, event);
  }
  return { format: chosen, events: [...deduped.values()] };
}
