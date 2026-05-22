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

**ChunkLoadError: Loading chunk X failed**

Usually indicates:
- Stale build (run `pnpm --filter @jbrowse/web build` before tests)
- Corrupted /tmp (clean with `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`)
- Missing webpack chunks in build output

**Environment Setup Issues**

If tests crash immediately on page navigation:
1. Check system Chrome isn't snap (broken libraries) → use Puppeteer's cached binary
2. Clean `/tmp/puppeteer_*` directories (old test artifacts corrupt Chrome sessions)
3. Rebuild fresh: `rm -rf build && pnpm build`
4. Kill stray processes: `fuser -k 3333/tcp && pkill -9 chrome firefox`

## Browser Test Environment (Troubleshooting)

### Startup Crashes / ERR_INSUFFICIENT_RESOURCES

**Common causes:**

1. **Corrupted Puppeteer cache** → crashes with "HistoryService::Init() failed"
   - Fix: `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`

2. **System Chrome (snap) broken** → "libpxbackend-1.0.so not found"
   - Fix: Use Puppeteer's cached binary (it auto-downloads to `~/.cache/puppeteer/`)
   - Verify: Puppeteer should use its own Chrome unless explicitly configured

3. **Stale build with missing chunks** → ChunkLoadError: chunk 2568
   - Fix: Full rebuild: `rm -rf build && pnpm --filter @jbrowse/web build`
   - Then: `pnpm test:browser`

4. **Port 3333 in use** → EADDRINUSE
   - Fix: `fuser -k 3333/tcp` or find/kill process using netstat

### Resource Exhaustion

Tests fail with ERR_INSUFFICIENT_RESOURCES after 3-4 tests:
- Likely GPU/WebGL context accumulation despite event listener cleanup
- WebGL2Hal already removes event listeners on dispose (commit be09a5bc87)
- Monitor with: Chrome DevTools Protocol or process monitoring
- May need additional resource cleanup in test runner between suites

## Unit Tests

157 Jest tests (15 suites), co-located (`*.test.ts`). Run with `pnpm test-ci`.  
Fast, Node-based. Use for logic, config, RPC, buffer packing.  
Browser tests for rendering and UI.

