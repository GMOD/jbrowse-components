# Browser Test Infrastructure

Puppeteer-based browser tests in `products/jbrowse-web/browser-tests/`.

## Running tests

Always build first: `pnpm --filter @jbrowse/web build`

```sh
# Default backend (Canvas 2D fallback)
node --experimental-strip-types browser-tests/runner.ts

# WebGL backend
node --experimental-strip-types browser-tests/runner.ts --backend=webgl

# WebGPU backend (requires lavapipe or real GPU — see below)
xvfb-run --auto-servernum \
  VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
  node --experimental-strip-types browser-tests/runner.ts --backend=webgpu

# Firefox (WebGL2 only on Linux)
node --experimental-strip-types browser-tests/runner.ts --firefox=/path/to/firefox

# Filters and options
--filter=alignments    # run only suites matching this string
--headed               # open browser window
--update-snapshots     # regenerate golden snapshots
--auth                 # run auth test suites
```

## Test suites

21 suites, ~120 test cases:

alignments, bigwig, variants, synteny, dotplot, HiC, canvas2d-fallback,
canvas2d-variants, rendering-backends, color-by-tag, wiggle-color, workspaces,
session-spec, demo-inventory, svg-export, authentication, main-thread-rpc,
custom-url, redraw, basic-lgv, misc

## Snapshots

- Golden snapshots stored in `browser-tests/__snapshots__/{webgl,webgpu,canvas2d}/`
- Screenshot comparison via pixelmatch (threshold 0.1)
- `compare-backends.ts` for cross-backend visual regression (identical / similar
  <5% / different ≥5%)

## WebGPU local testing (Firefox headed)

Firefox with a real GPU supports WebGPU in headed mode locally:

```sh
node --experimental-strip-types browser-tests/runner.ts \
  --backend=webgpu --firefox --headed
```

`FIREFOX_NIGHTLY_PATH` env var or `--firefox=/path/to/firefox` sets the binary.
This is the easiest way to verify WebGPU rendering locally without needing
Vulkan/lavapipe setup.

## WebGPU on CI (lavapipe)

Install software Vulkan on the CI runner before running the WebGPU pass:

```yaml
- run: sudo apt-get install -y mesa-vulkan-drivers
- run: |
    xvfb-run --auto-servernum \
      VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
      node --experimental-strip-types browser-tests/runner.ts --backend=webgpu
  working-directory: products/jbrowse-web
```

Chrome flags already in `runner.ts` for WebGPU:
`--enable-unsafe-webgpu --enable-features=Vulkan,UseSkiaRenderer --use-angle=vulkan --disable-vulkan-surface`

macOS runners also work (real GPU available) but cost ~10× more.

## Unit tests

157 Jest tests across 15 suites, co-located with source (`*.test.ts`).
Run with: `pnpm test-ci`

Browser test runner forwards `[alignments]` and `[webgl-wiggle]` console logs for debugging.
