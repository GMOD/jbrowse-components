# @jbrowse/graph-server

Minimal Express server that runs `odgi` or `vg` locally to extract subgraphs
from pangenome graph files. Pairs with `GfaServerAdapter` in
`plugins/comparative-adapters` so JBrowse can power MultiLGVSyntenyDisplay and
GraphGenomeView from a runtime backend instead of the static-file
GfaTabixAdapter.

Inspired by sequenceTubeMap's `server.mjs` (MIT, vgteam) — same `spawn(...)`
shape, narrower API surface tuned to JBrowse's two consumers.

## Backends

| Backend | Index format | Build cost | Per-extract cost (chr20, 10 kb) | Notes |
|---|---|---|---|---|
| `odgi` (default) | `.og` | ~70 s for chr20 | ~9 s (full graph deserialise each call) | Default; W→P conversion for legacy GFAs handled transparently |
| `vg` | `.xg` | ~90 s (via `vg convert -x`) | **~0.9 s** (mmap-backed succinct index) | Opt-in; recommended for any large graph where small-region browsing matters |

Pick a backend per dataset in `datasets.json`. `vg` is ~10× faster on the small
regions (≤ 100 kbp) that drive GraphGenomeView and per-tile MultiLGV synteny
queries; it loses on > 1 Mbp where the algorithmic cost dominates — but those
regions belong to the coarsened-tier static-file path, not the runtime server.

## Run

```bash
GRAPH_SERVER_DATASETS=/abs/path/datasets.json \
ODGI=$HOME/src/vendor/odgi/bin/odgi \
VG=$HOME/.local/bin/vg \
PORT=5001 \
pnpm start
```

`datasets.json`:

```json
{
  "datasets": [
    { "id": "volvox", "graph": "/abs/path/volvox_pangenome_50.gfa" },
    { "id": "chr20",  "graph": "/abs/path/chr20.vg", "backend": "vg" }
  ]
}
```

- `backend` defaults to `"odgi"` if omitted.
- For `odgi`, accepted `graph` inputs: `.og`, `.gfa`, `.gfa.gz`. Missing `.og`
  is built on first setup; W-line GFAs are auto-converted to P-line before
  building (odgi v0.9.4 silently drops W-lines).
- For `vg`, accepted `graph` inputs: `.xg`, `.vg`, `.gfa`, `.gfa.gz`, `.pg`,
  `.hg`. Missing `.xg` is built via `vg convert -x` on first setup.
- All built indexes and the paths-cache sidecar are written next to the source
  file (see "Caching" below).

## Endpoints

All under `/api/v0`. Request bodies are `application/json`; responses are JSON
unless noted.

- `GET /health` → `{status, odgi, datasets}`
- `GET /datasets/:id/setup` → `{id, paths, assemblies, chromSizes}`
  - `paths`: every path in the graph as `{name, length, genome, refName, subwalkStart, subwalkEnd}`.
  - `assemblies`: deduplicated PanSN genome ids (the "rows" displayed in MultiLGV).
  - `chromSizes`: `{genome, refName, length}` aggregated per `(genome, refName)`.
- `POST /datasets/:id/subgraph` body `{refName, start, end, genome?, context?}`
  → `text/plain` GFA. `context` is `odgi extract -c` / `vg find -c` (node
  steps; default `1`).
- `POST /datasets/:id/synteny` body `{refName, start, end, genome?, context?}`
  → `{features: [{queryGenome, mateRefName, start, end, mateStart, mateEnd,
  strand, identity, cs?, ...}]}`. Features are derived by walking shared nodes
  between the ref path and every other path in the extracted subgraph;
  adjacent co-linear runs are merged and bubble spans get a `cs` mismatch
  string for SNP/indel rendering.

## PanSN parsing

Path names are parsed into `(genome, refName, subwalkStart, subwalkEnd)`:

| Form | Example | Genome | RefName | Subwalk |
|---|---|---|---|---|
| 2-part | `GRCh38#chr20` | `GRCh38` | `chr20` | full |
| 3-part | `CHM13#0#chr20` | `CHM13#0` | `chr20` | full |
| 4-part (vg-style) | `HG00438#1#JAHBCB010000074.1#0` | `HG00438#1` | `JAHBCB010000074.1` | full |
| Colon subwalk | `CHM13#0#chr20:100864-26386516` | `CHM13#0` | `chr20` | 100864..26386516 |
| Bracket subwalk | `CHM13#chr20[100864-26386516]` | `CHM13` | `chr20` | 100864..26386516 |

The 4-part variant exists because vg emits `sample#hap#contig#fragment` for
fragmented haplotype assemblies; the trailing fragment index is a vg-internal
split key, not part of the assembly id, and is dropped during parsing.

## Caching

Two layers, both written to disk next to the source graph file:

1. **Index files** (`.og`, `.xg`) — built once on first setup, reused on
   subsequent boots. Build cost is one-time per dataset.
2. **Paths sidecar** (`<index>.paths.json`) — the parsed `PathInfo[]` list
   produced from `odgi paths -Ll` / `vg paths -E`. Boot setup loads this
   instead of re-shelling, dropping chr20 cold-boot setup from ~55 s to
   ~100 ms. Invalidated automatically on `(file size, mtime)` change, so
   rebuilding the index regenerates the sidecar transparently.

There is also an in-memory LRU of extracted GFA blobs keyed by
`(datasetId, region, context)` (default 64 entries; override with
`GRAPH_SERVER_EXTRACT_CACHE_MAX`). Both `/subgraph` and `/synteny` consult it
on the way in.

## Standalone test

```bash
# Volvox smoke (odgi backend)
pnpm test:manual

# Synteny / parsePanSN unit tests
pnpm exec node --experimental-strip-types --test test/*.test.ts

# Perf harness against HPRC chr20
BACKEND=odgi pnpm exec node --experimental-strip-types test/perf-chr20.ts
BACKEND=vg   pnpm exec node --experimental-strip-types test/perf-chr20.ts
```
