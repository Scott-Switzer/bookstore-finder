# bookloop

A playful, small static bookstore finder for the pilot cities Singapore, New York City, and Chicago.

## Run locally

Serve this folder with any static file server (for example, `python -m http.server 8000`) and open the local address in a browser. Serving over HTTP avoids cross-origin restrictions that can affect `file://` pages. The prototype loads Leaflet and map tiles over the internet.

## Prototype data

The bookstore finder and `events.html` use fictional sample records from `prototype-data.js` and `events.js`. These are deliberately labeled as samples in the UI and exist only to make the vibe filters, map pins, city selector, event cards, and date filters testable. They are not real bookstore or event recommendations.

Vibe categories use OR matching among selected tags within a category, and AND matching between categories. For example, selecting “Used books” and “Sci-fi & fantasy” in Selection matches either tag; adding “Cozy” in Atmosphere then requires the bookstore to also have that atmosphere tag. Search text is applied together with the vibe filters.

## Current data sourcing status

The UI prototype does not scrape directories or fetch live bookstore/event data. For a real launch, replace the example records with verified bookstore and event information from permitted directories, APIs, or owner-submitted sources. Review each source's terms and attribution requirements, retain source links and verification dates, and don't imply independent status or details such as accessibility have been confirmed unless they have.

## Next steps

### 1. Replace sample shops with a verified indie bookstore directory

The map currently uses fictional sample listings so the prototype can demonstrate vibe filtering without presenting unverified locations as real. Replace those examples with independent-bookstore directory data. OpenStreetMap may later be used as an optional location source, but it does not distinguish independent stores from chains consistently.

- Identify reputable directories and sources for Singapore, New York City, and Chicago. Track each source's owner, URL, coverage, last-checked date, terms of use, attribution requirements, and whether automated collection is permitted.
- Review terms of service, robots.txt, copyright, and applicable privacy rules before scraping. Prefer an official API, downloadable dataset, or permission from the directory when available. Do not bypass access controls or rate limits.
- Implement a separate, source-specific import for each permitted source. Normalize records into a common bookstore format, and retain source attribution and the source record URL so entries can be checked later.
- Deduplicate against OSM and other directories using stable IDs where available, then compare normalized names, addresses, and coordinates. Flag uncertain matches for manual review rather than merging them automatically.
- Treat directory membership as evidence of indie status, not an unconditional guarantee. Record the source and date used to verify a store, and provide a way to report a closure or incorrect listing.
- Keep OSM as an optional location source or fallback, while clearly distinguishing OSM-only results from directory-verified independent bookstores.
- For a production deployment, run imports on a schedule on a backend, cache results, log source failures, and review changes before publishing. Avoid making a visitor's browser scrape directory websites directly.

### 2. Connect vibe categories to verified bookstore tags

The interactive category tabs and multi-select chips are implemented as a prototype. Connect them to a small, consistent vocabulary of reviewed bookstore tags. A first version could include:

- **Selection:** used books, sci-fi & fantasy, romance, art & design, children's books, local authors, zines & small press.
- **Atmosphere:** cozy, quiet, bright, spacious, browse-for-hours.
- **Experience:** staff picks, author events, book clubs, readings, café.
- **Practical:** budget-friendly, accessible entrance, open late.

Keep the first release focused on a manageable set of tags; categories can be adjusted based on what readers actually use. Define clear guidance for subjective tags such as “cozy” and use factual descriptions only when they have been checked.

- Display the categories as tabs in the bookstore explorer, with selectable tag chips within each tab. Make active selections obvious, allow multiple selections, and include a clear-filters action.
- Use a predictable filter rule: selected tags within one category match any of those tags; when tags are selected in multiple categories, a bookstore must match at least one selection in each selected category.
- Show the result count as filters change, and provide a helpful empty state when no bookstores match.
- Keep curated tags separate from OSM records. Associate them with a stable bookstore ID and store their source, status (for example, editor-reviewed, store-confirmed, or community-suggested), and last-updated date.
- Start with editor-curated tags for the pilot. If readers or stores can suggest tags later, queue those suggestions for review instead of publishing them immediately.
- Label tags by provenance so users can tell whether a detail was verified by a bookstore, reviewed by the project, or suggested by the community.

### 3. Replace sample events with verified upcoming events

The separate `events.html` page already demonstrates city and date filtering with fictional sample events. Replace them with verified upcoming events for Singapore, New York City, and Chicago, including links to the original event listing.

- Include the event title, bookstore, city, start date and time, timezone, event page URL, and the date the listing was last checked. Add an end time, cost, or registration link when the source provides it.
- Collect event information only from sources that permit reuse or provide an API/feed. Check source terms and attribution requirements; link visitors to the source rather than copying unnecessary description text.
- Store event records separately from bookstore records and associate each with a bookstore ID where possible. Retain the source URL and source name for verification.
- Expire or archive past events automatically. Recheck upcoming listings regularly and provide a way to report cancelled, changed, or missing events.
- Show clear loading, empty, and unavailable states for each city so a data-source outage does not look like there are no events.
- Begin with a small, manually reviewed set of event sources for each city. Automate collection only after permissions and a reliable update process are established.

### Suggested implementation order

1. Select and document permitted directory and event sources for all three cities.
2. Create normalized bookstore and event data formats, including stable IDs and source attribution.
3. Import and manually verify a small pilot dataset; keep OSM as a clearly labeled fallback.
4. Connect the existing vibe-category tabs and filters to curated tags.
5. Connect the events page to verified city-specific events, then automate refresh and expiry once the source workflow is reliable.
6. If the project grows beyond a static prototype, move imports and scheduled refreshes to a small backend with caching, monitoring, and an editorial review process.
