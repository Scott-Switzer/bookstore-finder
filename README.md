# bookloop

A playful, small static bookstore finder for the pilot cities Singapore, New York City, and Chicago.

## Run locally

Serve this folder with any static file server (for example, `python -m http.server 8000`) and open the local address in a browser. Serving over HTTP avoids cross-origin restrictions that can affect `file://` pages. The page loads Leaflet from unpkg and requests bookstore listings from the OpenStreetMap Overpass API, so an internet connection is required.

## Bookstore data

The MVP uses OpenStreetMap features tagged `shop=books`; it does not scrape bookstore websites. This keeps the initial data path simple and avoids scraping sites with different terms and formats. Coverage depends on community contributions, so listings may be incomplete. OpenStreetMap does not consistently distinguish independent stores from chains, so the results are leads rather than verified indeIpendent-bookstore recommendations. The app links to OpenStreetMap to help visitors report missing or incorrect locations.

The app queries a radius around each pilot city center. OpenStreetMap data is available under the Open Database License (ODbL); map and data attribution are shown in the interface. The public Overpass service can be rate-limited or temporarily unavailable, in which case the page displays an error and visitors can retry by selecting the city again.

## Next steps

### 1. Build a verified indie bookstore directory

The current map uses OpenStreetMap's `shop=books` tag as a starting point. The next data source should be independent-bookstore directories, which can help identify stores that OSM does not distinguish from chains.

- Identify reputable directories and sources for Singapore, New York City, and Chicago. Track each source's owner, URL, coverage, last-checked date, terms of use, attribution requirements, and whether automated collection is permitted.
- Review terms of service, robots.txt, copyright, and applicable privacy rules before scraping. Prefer an official API, downloadable dataset, or permission from the directory when available. Do not bypass access controls or rate limits.
- Implement a separate, source-specific import for each permitted source. Normalize records into a common bookstore format, and retain source attribution and the source record URL so entries can be checked later.
- Deduplicate against OSM and other directories using stable IDs where available, then compare normalized names, addresses, and coordinates. Flag uncertain matches for manual review rather than merging them automatically.
- Treat directory membership as evidence of indie status, not an unconditional guarantee. Record the source and date used to verify a store, and provide a way to report a closure or incorrect listing.
- Keep OSM as an optional location source or fallback, while clearly distinguishing OSM-only results from directory-verified independent bookstores.
- For a production deployment, run imports on a schedule on a backend, cache results, log source failures, and review changes before publishing. Avoid making a visitor's browser scrape directory websites directly.

### 2. Add bookstore vibe categories and tabs

Create a small, consistent tag vocabulary and organize it into category tabs. A first version could include:

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

### 3. Add upcoming book events for each pilot city

Add an Upcoming Book Events section for Singapore, New York City, and Chicago. The section should be city-specific and include events at listed bookstores as well as a link to the original event listing.

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
4. Add the vibe-category tabs and filters using curated tags.
5. Add city-specific upcoming events, then automate refresh and expiry once the source workflow is reliable.
6. If the project grows beyond a static prototype, move imports and scheduled refreshes to a small backend with caching, monitoring, and an editorial review process.
