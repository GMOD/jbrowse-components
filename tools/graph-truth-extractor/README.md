# graph-truth-extractor

Reference subgraph extractor used as a correctness oracle for the
`GfaTabixAdapter.getSubgraph` static-file extraction. Wraps four backends behind
a single TypeScript interface:

- **`vg`** — `vg find -p PATH:start-end -c k -x graph.xg`. Lazily builds
  `graph.xg` under `<gfa>.truth-cache/` on first call.
- **`odgi`** — `odgi extract -i graph.og -r PATH:start-end -c k`. Lazily builds
  `graph.og`.
- **`chunkix`** —
  `python3 ~/src/sequencetubemap/scripts/chunkix.py -p pos.bed.gz -n nodes.tsv.gz -g haps.gaf.gz -r PATH:start-end`.
  Most direct prior-art comparison.
- **`naive`** — pure-Node BFS from path-walked seed segments. Used as a tertiary
  oracle and as the fallback when none of the external tools is on PATH.

See `agent-docs/NEW_GRAPH_PLAN.md` for the active plan and
`agent-docs/GRAPH_AUDIT.md` for Phase 0 findings on volvox + HPRC chrM fixtures.

## Quick Start

**Validate GetSubgraph on chr20 pangenome:**

```bash
node --experimental-strip-types tools/graph-truth-extractor/setup-chr20-validation.ts
```

This generates tabix indices and runs 6 validation tests. See
`CHR20_SETUP_GUIDE.md` for details.

**Test a region with all backends:**

```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --all-backends \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path ref#0#ctgA --start 1000 --end 5000
```

## Pinned versions

The audit harness checks installed-tool versions on first call and fails loudly
if the local install is older than these pins:

- `vg ≥ 1.59.0`. Tested at v1.69.0 ("Bologna"). Install via
  `curl -L -o vg https://github.com/vgteam/vg/releases/download/v1.69.0/vg && chmod +x vg`
  or use Docker `quay.io/vgteam/vg:v1.69.0`.
- `odgi ≥ 0.9.0`. Install via `conda install -c bioconda 'odgi>=0.9'` or build
  from source.
- `sequencetubemap` (tabix branch). Clone to `~/src/sequencetubemap`, checkout
  `tabix` branch. Override location with
  `SEQUENCETUBEMAP_DIR=/path/to/checkout`.
- Node ≥ 24 for `--experimental-strip-types`.

## Usage (CLI)

Single backend, raw or canonical output:

```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --backend vg \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path ref#0#ctgA --start 0 --end 1000 --context 1 \
  --emit canonical \
  > /tmp/truth.canonical.gfa
```

`--emit raw|canonical|json` picks the output mode.

All backends in a single run, with disagreement detection:

```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path ref#0#ctgA --start 0 --end 1000 \
  --all-backends
```

Exit code is non-zero if backends produce non-isomorphic canonical forms.

## Usage (library)

Imported directly by the Jest concordance suite in
`plugins/comparative-adapters/src/GfaTabixAdapter/`:

```ts
import { extractTruthSubgraph } from '../../../../tools/graph-truth-extractor/index.ts'
import { canonicalize } from '../../../../tools/graph-truth-extractor/canonicalize.ts'

const truth = await extractTruthSubgraph({
  gfaPath,
  pathName,
  start,
  end,
  context: 1,
  backend: 'vg',
})
const oursGfa = await adapter.getSubgraph({ refName, start, end, assemblyName })
expect(canonicalize(oursGfa)).toBe(canonicalize(truth.gfa))
```

Tests gated on tool availability skip with a clear message rather than fail when
the relevant external is missing.

## Bash convenience wrapper

For ad-hoc developer use during Phase 0:

```bash
bash tools/graph-truth-extractor/test-subgraph-concordance.sh \
  --prefix test_data/volvox/volvox_pangenome_50 \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path ref#0#ctgA --start 0 --end 1000 --context 1 \
  --backend vg
```

The Jest suite imports the library directly, not this wrapper.

## Canonicalization

`tools/graph-truth-extractor/canonicalize.ts` implements Weisfeiler-Lehman color
refinement on `(length, sorted-neighbor-set)` (Phase 0; Phase 1 will switch to
`(sequence-hash, ...)` once `segments.seq.bin` exists). Bidirected edges and
reverse-complement walks are normalized before equality comparison. W-line
`:offset` suffixes are stripped from path names so `ref#0#ctgA:0` ≡
`ref#0#ctgA`.

A second canonicalization path via `odgi build → odgi sort -O → odgi view` was
reserved as an option in the plan but not implemented; the in-process TypeScript
canonicalizer is the only path today, which removes the odgi dependency for the
canonicalization step (odgi is still useful as a third independent oracle).

## Known backend disagreements

- **chunkix on P-line GFAs** — `~/src/sequencetubemap/scripts/pgtabix.py`
  references an `args.r` argument that is not defined in its argparse setup,
  causing the P-line code path to crash. W-line GFAs (e.g. HPRC chrM after
  `vg view`) work. Documented as F5 in `agent-docs/GRAPH_AUDIT.md`.
- **vg PanSN renaming** — `vg convert -g <gfa> -x` rewrites `ref#0#ctgA` →
  `ref#0#ctgA#0`. The `vg` backend's `resolveVgPathName` lists paths and matches
  by exact name + suffix. Documented as F4 in `agent-docs/GRAPH_AUDIT.md`.

## Documentation

**Active guides:**

- `CHR20_SETUP_GUIDE.md` — Set up and run GetSubgraph validation on chr20
  pangenome
- `CLAUDE.md` — Implementation notes (canonicalization, backends)

**Audits and results:** (see `audits/` folder)

- `audits/FINAL_SUMMARY.md` — Overall audit summary
- `audits/AUDIT_RESULTS.md` — Backend audit analysis
- `audits/TEST_RESULTS.md` — Comprehensive test matrix
- `audits/CHR20_VALIDATION.md` — CHR20 validation report

## See also

- `agent-docs/NEW_GRAPH_PLAN.md` — Active pangenome browser planning
- `agent-docs/GRAPH_AUDIT.md` — Phase 0 findings from this harness
- `agent-docs/GRAPH_INDEX_FORMAT.md` — File-format spec for preprocessor outputs
- `agent-docs/TEST_INFRASTRUCTURE.md` — GetSubgraph validation section
- `plugins/comparative-adapters/scripts/dump-subgraph.ts` — "ours" side wrapper
