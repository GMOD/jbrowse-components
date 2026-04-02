# Brainstorm: Server-side vg Integration for Graph/Synteny Views

## Context

sequenceTubeMap demonstrates two approaches for extracting graph subregions:

- **Server-side**: Express server spawns `vg chunk` → `vg view -j` subprocess
  pipeline, returns JSON over REST
- **Client-side**: gbz-base WASM library runs in a Web Worker, no server needed

JBrowse currently extracts subgraphs via adapter-side GFA parsing
(GfaAdapter/GfaTabixAdapter). This works but is limited to pre-processed
GFA/tabix data and doesn't leverage vg's native graph operations.

## How sequenceTubeMap's vg server works

```
Client POST /api/v0/getChunkedData
  { region: "chr1:1000-2000", tracks: [{file: "graph.xg", type: "graph"}] }

Server:
  vg chunk -x graph.xg -p chr1:1000-2000 -c 20 -T -b /tmp/chunk
  | vg view -j -
  → JSON { node: [...], edge: [...], path: [...] }

Response: { graph: {...}, gam: [...], region: [start, end] }
```

Key properties:
- `vg chunk` handles topology-aware extraction natively (context steps, not
  just coordinate overlap)
- Supports reading .xg, .gbz, .gbwt formats directly
- Can include read alignments (.gam/.gaf) in the same query
- The `-c 20` flag adds 20 context steps beyond the region, capturing
  surrounding graph structure

## Comparison with current JBrowse approach

| Aspect | JBrowse (GfaAdapter) | sequenceTubeMap (vg server) |
|--------|---------------------|---------------------------|
| Data source | Pre-parsed GFA text or tabix-indexed | .xg, .gbz, .gbwt (native vg formats) |
| Extraction | Coordinate-based span on paths | Topology-aware with context steps |
| Subgraph quality | Good for simple bubbles, may miss complex topology | Handles all graph structures |
| Performance | Fast (in-memory or indexed) | Depends on vg chunk speed |
| Deployment | No server needed | Requires vg binary on server |
| Format | GFA text | vg JSON (protobuf-compatible) |

## Options for JBrowse integration

### Option A: VgServerAdapter

A new JBrowse adapter that calls a vg server over REST.

```typescript
// Config
{
  type: 'VgServerAdapter',
  serverUrl: 'http://localhost:3000',
  graphFile: 'graph.xg',
  haplotypesFile: 'haplotypes.gbwt', // optional
  gamFiles: ['reads.gam'],           // optional
}

// The adapter implements:
// - getSubgraph(region) → calls vg server, returns GFA
// - getMultiPairFeatures(region) → calls vg server, converts to synteny features
```

Pro: Uses vg's native graph operations, handles .xg/.gbz directly
Con: Requires a running server with vg installed

The server could be:
- sequenceTubeMap's existing Express server (already has the API)
- A lightweight proxy that just spawns vg chunk
- A JBrowse plugin server endpoint

### Option B: GbzWasmAdapter

Use gbz-base WASM library (same as sequenceTubeMap's LocalAPI) to query
GBZ files client-side.

```typescript
// Config
{
  type: 'GbzAdapter',
  gbzLocation: { uri: 'https://example.com/graph.gbz' },
}

// Runs gbz-base WASM in a Web Worker (via JBrowse's RPC system)
```

Pro: No server needed, works with hosted static files
Con: Large GBZ files must be fetched, WASM overhead, limited to what
gbz-base supports

### Option C: Generic GraphServerAdapter

Define a minimal REST API spec, adaptable to any backend (vg, odgi,
minigraph, etc.).

```
GET /subgraph?region=chr1:1000-2000&context=20&format=gfa
→ GFA text

GET /paths?graph=graph.xg
→ ["chr1", "chr2", ...]

GET /features?region=chr1:1000-2000
→ [{start, end, mate_start, mate_end, ...}]
```

Pro: Backend-agnostic
Con: Needs a spec, each backend needs an adapter shim

## What would change in JBrowse

For any option, the integration points are:

- **New adapter type** implementing `getSubgraph()` and optionally
  `getMultiPairFeatures()`
- **GetSubgraph RPC** already handles any adapter with `getSubgraph()` — no
  changes needed
- **GraphGenomeView.loadGFA()** already parses GFA — works with adapter
  returning GFA text
- **MultiLGVSyntenyDisplay** graph launch menu items already call
  `GetSubgraph` RPC — works automatically with any adapter

The existing architecture is well-suited: adding a new adapter is all that's
needed. The RPC, display, and graph view layers don't need changes.

## Comparison: vg chunk vs GfaAdapter.getSubgraph

vg chunk advantages:
- **Context steps**: `-c N` adds N graph traversal steps beyond the region,
  capturing topology that coordinate overlap misses
- **Handles complex structures**: inversions, translocations, nested bubbles
- **Native format support**: reads .xg, .gbz directly without pre-processing
  to GFA/tabix
- **Read integration**: can extract alignments for the same region in one call

GfaAdapter advantages:
- **No external dependencies**: pure JS, runs anywhere
- **No server**: works with static file hosting
- **Indexed access**: GfaTabixAdapter handles large pangenomes efficiently
- **Simpler deployment**: just add a GFA file to the data directory

## Recommendation

Start with **Option A (VgServerAdapter)** as it's the simplest path:
- sequenceTubeMap's server already has the REST API
- The adapter is straightforward: HTTP fetch → parse JSON → convert to GFA
- Lets users compare vg's extraction quality with the current GFA approach
- Can coexist with existing GFA adapters — user chooses based on their setup

Option B (WASM) is interesting for the future but has more unknowns around
gbz-base's API stability and browser memory limits for large graphs.
