# All-vs-all PAF → any-vs-any multi-way synteny — design notes

Status: planning only (no code written). Tracks the idea started in
GMOD/jbrowse-components PR #4985 ("All-vs-all PAF adapter").

## Goal

A single all-vs-all PAF (e.g. `minimap2 all.fa all.fa`, PanSN-prefixed
refNames from fastix/PGGB) should drive an N-row LinearSyntenyView where any
pair of assemblies can be compared, without the user hand-configuring A-vs-B
and B-vs-C tracks separately. "All comparisons exist, so it can be
auto-prepared."

## The insight that makes this tractable

The multi-way view machinery is already in place (N views, N-1 levels,
per-level displays sharing one adapterConfig, distinct `displayKey` per
display). The two facts that let one all-vs-all track serve every level:

- **RPC associates a feature with top vs bottom view purely by refName**, not
  by assemblyName. `executeSyntenyFeaturesAndPositions.ts:188`:
  ```
  if (!v1RefNames.has(refName) || !v2RefNames.has(mateRefName)) { continue }
  ```
  A feature is drawn on a level only if its `refName` is in the top view's
  region index AND its `mate.refName` is in the bottom view's index.
- **`getSyntenyTracks` matches superset pairs**. `getSyntenyTracks.ts:18`:
  ```
  assemblies.every(name => assemblyNames.includes(name))
  ```
  A track whose `assemblyNames` lists all N assemblies is returned for every
  adjacent pair query `[A,B]`.

So: an all-vs-all SyntenyTrack listing all N assemblies is already offered for
every pair, and the RPC already separates A↔B from A↔C per level — *provided
each feature's two endpoints resolve to the correct per-view refNames*. Each
level's display has a unique MST id → unique `displayKey`
(`syntenyDisplayKey(self.id)`), so sharing one track across all levels is safe.

## What PR #4985 has, and its gap

The stub reads an all-vs-all file but is still fundamentally 2-way:

- `assemblyNames` is a fixed `[query, target]` pair.
- mate assembly is hardcoded `assemblyNames[+flip]` — wrong when the mate can
  be any of N assemblies.
- strips only a hardcoded haplotype prefix `${query.assemblyName}#1#`.

For true any-vs-any: the mate's assembly must be **parsed from the mate
endpoint's own PanSN prefix**, and the adapter must know all assemblies.

## The one real design decision: refName model

PanSN names (`HG002#1#chr1`) are globally unique; bare names (`chr1`) collide
across assemblies. Because the RPC filters on refName, the adapter's
`getRefNames` return value defines the adapter namespace and
`renameRegionsForAdapter` aligns the view regions to it.

| Row assemblies' refNames | Adapter should | Config burden |
|---|---|---|
| Bare `chr1` (common) | strip prefix → `chr1` | zero |
| PanSN `HG002#1#chr1` | don't strip | zero, assemblies must be PanSN-named |
| Bare, but keep PanSN | keep PanSN | per-assembly `refNameAliases` (heavy) |

How to tell which: compare PAF column 1/6 (qname/tname) against the per-row
assembly `.fai` refNames.

### Resolution (avoids committing up front)

- Make stripping a **config slot** (`stripAssemblyPrefix` / `prefixSeparator`,
  default = strip on `#`).
- Add the RPC **assemblyName guard unconditionally**:
  `feature.assemblyName === topAssembly && mate.assemblyName === bottomAssembly`.
  No-op for every existing pairwise adapter; the safety net that lets bare
  colliding refNames still separate per level.

Bare-refName users (common) get correct results with zero extra config;
PanSN-refName users flip one flag.

## Phased plan

- **Phase 1 — `AllVsAllPAFAdapter`** (evolve PR #4985, don't merge as-is):
  - `assemblyNames`: full N-list, or auto-derived from distinct PanSN prefixes
    during `setup()`.
  - `parsePanSN(name, sep) → { assembly, refName }`, handling `asm#chr` and
    `asm#hap#chr`. Replaces hardcoded `#1#` and `assemblyNames[+flip]` — mate
    assembly comes from the mate endpoint's own prefix.
  - `getRefNames(asm)`: that assembly's stripped (or full) refNames.
  - Fix `getWeightedMeans` keying to parsed assembly+refName
    (`PAFAdapter/util.ts:68` uses raw `qname-tname`).
  - Tests: tiny 3–4 assembly PAF, assert any-pair `getFeatures` returns the
    right mates.

- **Phase 2 — RPC guard**: derive top/bottom assembly from view snaps in
  `executeSyntenyFeaturesAndPositions`, add the two-clause guard. ~5 lines,
  backward-compatible.

- **Phase 3 — MVP via existing import form**: add N rows, pick the single
  all-vs-all track per pair (already qualifies via `getSyntenyTracks` superset
  match). End-to-end proof, no new UI.

- **Phase 4 — specialized import form** (deferred convenience): one all-vs-all
  track/file → auto-detect assemblies → order/select rows → auto-wire all
  levels to the one track, skipping the N-1 manual pickers.

- **Later optimization**: thread target assembly into `getFeatures` so the
  adapter pre-filters, instead of the RPC discarding A→C rows while drawing
  A↔B. Needs an opts/query extension.

## Open items

- Confirm PanSN separator/haplotype convention in the real files (`#`
  standard; exceptions?).
- `assemblyNames` explicit config vs. auto-detected from file. Auto is nicer
  but the list isn't known until `setup()`, which the import form must await.

## Key file references

- `plugins/comparative-adapters/src/PAFAdapter/PAFAdapter.ts` — pairwise
  reference; `getFeatures` flip logic, mate `assemblyNames[+flip]` at ~:161.
- `plugins/comparative-adapters/src/util.ts:14` — `getAssemblyNamesFromConf`.
- `plugins/comparative-adapters/src/PAFAdapter/util.ts:60` — `getWeightedMeans`
  (keying to fix).
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts:188`
  — refName-based association (guard goes here).
- `packages/synteny-core/src/getSyntenyTracks.ts:18` — superset pair match.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts` —
  per-level fetch, `views[level]`/`views[level+1]`, `renameRegionsForAdapter`.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyDisplayKey.ts`
  — displayKey from MST id (no cross-level collision).
