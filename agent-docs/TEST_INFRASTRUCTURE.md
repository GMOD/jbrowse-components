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
wiggle-color, workspaces, session-spec, demo-inventory, svg-export, authentication,
main-thread-rpc, custom-url, redraw, basic-lgv, misc.

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
- Environment issue? → Run suite in isolation, check `[alignments]` / `[webgl-wiggle]` logs

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
