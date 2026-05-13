# tools/graph-server

Express + odgi sidecar that powers `GfaServerAdapter` (in
`plugins/comparative-adapters`). Inspired by sequenceTubeMap's `server.mjs`
(MIT, vgteam) — same `spawn(odgi, ...)` shape, narrower API surface tuned to
JBrowse's two graph-data consumers (MultiLGVSyntenyDisplay, GraphGenomeView).

This is the **runtime** alternative to the static-file `GfaTabixAdapter`. The
tabix path remains the publication target (preprocessing once buys offline,
CDN-friendly delivery) — the server is what we use for prototyping new
features, large datasets where preprocessing is impractical, or any case
where a runtime backend with odgi semantics is simpler than re-deriving them
from custom static files.

## Pipeline

```
.gfa  ──build──▶  .og  ──extract──▶  subgraph .og  ──view─g──▶  GFA text   (backend: 'odgi', default)
.vg   ──convert─▶ .xg  ──find─────▶  subgraph .vg  ──view─g──▶  GFA text   (backend: 'vg', opt-in)
                                                                   │
                                                                   ├─▶ /subgraph response
                                                                   │
                                                                   └─▶ parse + path-pair walk
                                                                          │
                                                                          └─▶ /synteny response
```

`ensureOg` (`src/odgi.ts`) handles W-line GFAs transparently: odgi v0.9.4
silently drops W-lines on `odgi build`, so we detect a zero-paths .og and
re-build from a `.with-p.gfa` copy produced by `convertWLinesToPLines`
(`src/wToP.ts`). Both intermediates are cached next to the source `.gfa`.

`ensureXg` (`src/vg.ts`) is the vg counterpart: builds `.xg` from
`.vg`/`.gfa`/`.pg`/`.hg` once and caches alongside the input. The vg
extract path uses `vg find -p <region> -c <steps>` piped through
`vg view -g` to produce GFA. **Why offer it:** `odgi extract` deserialises
the full `.og` on every invocation (~6 s fixed cost for the chr20
1.13 GB .og); `vg find` over an `.xg` is mmap-backed and pays a near-
constant per-call cost (~0.9 s for 10 kb extracts on the same graph).
Trade-off: vg loses on very large regions (≥1 Mb) — but those belong
to coarsened-tier territory, served from the static-file path.

## Endpoints

All under `/api/v0`:

- `GET /health` — sanity check; returns odgi binary path and dataset list.
- `GET /datasets/:id/setup` — paths (PanSN-split into genome+refName) and
  derived assembly list.
- `POST /datasets/:id/subgraph` `{refName,start,end,genome?,context?}` →
  `text/plain` GFA. Region built as `<pansn-name>:<start>-<end>` and passed
  to `odgi extract -r ... -c <context>`, then `odgi view -g`.
- `POST /datasets/:id/synteny` `{refName,start,end,genome?,context?}` →
  `{features: SyntenyBlock[]}` derived from path-pair node intersection in
  the extracted GFA (`src/synteny.ts`). Adjacent co-linear blocks are merged.

## Caching

Two layers, both written to disk next to the source graph:

1. **Index files** (`.og`, `.xg`) — built once on first setup, reused on
   subsequent boots. One-time build cost per dataset.
2. **Paths sidecar** (`<index>.paths.json`) — the parsed `PathInfo[]` from
   `odgi paths -Ll` / `vg paths -E`. Setup loads this instead of re-shelling.
   Invalidated automatically on `(file size, mtime)` change so rebuilding
   the index regenerates the sidecar.

In-memory LRU of extracted GFA blobs keyed by `(datasetId, region, context)`
shared between `/subgraph` and `/synteny`. Default 64 entries; override with
`GRAPH_SERVER_EXTRACT_CACHE_MAX`.

## Performance notes

- Volvox 50-sample (~50 kbp pangenome): all endpoints < 30 ms end-to-end.
- HPRC chr20 (1.05 GB GFA, 1.86M segments, 90 haplotypes): see
  `test/perf-chr20.ts` for the canonical benchmark. **First-ever boot is slow**
  (~70 s if you start from a .gfa: odgi build + W→P conversion + odgi rebuild,
  or ~90 s for vg's `vg convert -x`); subsequent boots reuse the cached index.
  Setup path-enumeration is ~30 s the first time and ~100 ms once the paths
  sidecar is written.
- Cold `/synteny` 10 kb on chr20: ~9 s with odgi, **~0.9 s with vg**.
  Cache hit: ~3 ms either backend.

## Things that don't go in here

- **Sequence rendering / per-feature glyphs** — that's the display's job. The
  server emits structural data only.
- **Coarse / multi-resolution tiers** — see `feedback_static_file_coarsening`
  in memory; coarsening should be precomputed Rust output, not a runtime
  endpoint.
- **Auth, rate limiting, multi-tenant** — this is a developer/researcher
  tool, not production infra. If we ever need that, fork sequenceTubeMap's
  patterns rather than reinvent.

## See also

- `plugins/comparative-adapters/src/GfaServerAdapter/` — the JBrowse adapter
  that talks to this server.
- `test_data/config_graph_server.json` — minimal volvox config wired to a
  local server on :5001.
- `products/jbrowse-web/browser-tests/suites/graph-server.ts` — puppeteer
  end-to-end test (spawns server, exercises both consumers).
- Static-file alternative: `plugins/comparative-adapters/src/GfaTabixAdapter`
  + `tools/gfa-to-tabix` (Rust preprocessor).
