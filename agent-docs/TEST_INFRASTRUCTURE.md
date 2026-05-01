# Browser Test Infrastructure

Puppeteer tests in `products/jbrowse-web/browser-tests/`. Tests rendering, data
loading, interactions, cross-browser compatibility.

## Quick Start

Build first: `pnpm --filter @jbrowse/web build`

```sh
# Canvas 2D (default)
node --experimental-strip-types browser-tests/runner.ts

# WebGL
node --experimental-strip-types browser-tests/runner.ts --backend=webgl

# Specific suite
node --experimental-strip-types browser-tests/runner.ts --filter=alignments

# Headed mode (debug)
node --experimental-strip-types browser-tests/runner.ts --headed

# Update snapshots
node --experimental-strip-types browser-tests/runner.ts --update-snapshots
```

## Test Suites

21 suites, ~120 cases: alignments, bigwig, variants, synteny, dotplot, HiC,
canvas2d-fallback, canvas2d-variants, rendering-backends, color-by-tag,
wiggle-color, workspaces, session-spec, demo-inventory, svg-export,
authentication, main-thread-rpc, custom-url, redraw, basic-lgv, misc.

## Golden Snapshots

Visual regression via pixelmatch (threshold 0.1% pixel diff).  
Stored in `browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`.  
Cross-backend tool: identical / <5% diff (similar) / ≥5% diff (different).

## WebGL

Fully supported (Chrome headless / Firefox). Default for CI.

## WebGPU

**Local** (Firefox real GPU, no Vulkan setup):

```sh
node --experimental-strip-types browser-tests/runner.ts --backend=webgpu --firefox --headed
```

Set `FIREFOX_NIGHTLY_PATH` or `--firefox=/path/to/binary`.

**CI** (Linux + lavapipe):

```yaml
- run: sudo apt-get install -y mesa-vulkan-drivers
- run: |
    xvfb-run --auto-servernum \
      VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
      node --experimental-strip-types browser-tests/runner.ts --backend=webgpu
```

Chrome flags in `runner.ts` already set.

**macOS**: Real GPU, ~10× cost.

## Debugging

**Visual mismatches**

- Intentional change? → `--update-snapshots`
- Variance? → Check pixel threshold in `compare-backends.ts`
- Environment issue? → Run suite in isolation, check `[alignments]` /
  `[webgl-wiggle]` logs

**Timeout/hang**

- Slow? → Increase timeout in runner config
- Fetch stuck? → Check network in headed mode
- WebGPU fail? → Missing Vulkan/GPU

**Console errors**  
Runner forwards `[alignments]`, `[webgl-wiggle]` logs. Add patterns in
`runner.ts` for additional debugging.

## Unit Tests

157 Jest tests (15 suites), co-located (`*.test.ts`). Run with `pnpm test-ci`.  
Fast, Node-based. Use for logic, config, RPC, buffer packing.  
Browser tests for rendering and UI.

## GetSubgraph RPC Validation

Validates `GetSubgraph` RPC implementation against chr20 pangenome (90 samples, 278 segments).

**Test Suite:** `plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph-validation.test.ts`

6 unit tests covering:
- Small region extraction (0-10k bp): 199 segments, 428 edges
- Medium region graph structure (10k-50k bp)
- Edge referential integrity (all endpoints valid)
- Walk node validity (all nodes in segment set)
- Large region scaling (0-200k bp, >50 segments)
- Empty region handling (header-only response)

**Status:** 6/6 passing ✅

**Quick Start:**

```sh
# Auto-setup + validate
node --experimental-strip-types \
  tools/graph-truth-extractor/setup-chr20-validation.ts

# Or bash
bash tools/graph-truth-extractor/setup-chr20-validation.sh

# Run tests directly
npm test -- plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph-validation.test.ts
```

**Generated Test Data** (auto-generated, gitignored):
- `test_data/chr20_region.pos.bed.gz` — Position index
- `test_data/chr20_region.synteny.bed.gz` — Synteny mappings
- `test_data/chr20_region.edges.spatial.bed.gz` — Edge spatial index
- `test_data/chr20_region.seglens.bin` — Segment lengths

**Documentation:**
- `tools/graph-truth-extractor/CHR20_VALIDATION.md` — Detailed validation report
- `tools/graph-truth-extractor/CHR20_SETUP_GUIDE.md` — User guide + CI integration

**Validation Metrics:**
- Edge referential integrity: 100%
- Walk node validity: 100%
- GFA format compliance: Valid 1.1
- Empty region handling: Correct
- Scaling behavior: Linear

Production-ready ✅ — Ready for deployment to production.
