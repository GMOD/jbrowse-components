---
status: Accepted
summary: "Browser-test snapshots are per-backend, rendered on a real GPU, run locally"
---

# ADR-024: Browser-test snapshots are per-backend, rendered on a real GPU, run locally

## Status

Accepted

## Context

The puppeteer browser tests (`products/jbrowse-web/browser-tests/`) capture
golden PNG/SVG snapshots. JBrowse renders through three distinct code paths that
must each be exercised:

- **Canvas2D** — the `Canvas2D*` renderer/backend fallback (no GPU).
- **WebGL2** — the `WebGL2Hal` GPU path.
- **WebGPU** — the `WebGPUHal` GPU path.

These are genuinely different code (`createRenderingBackend`, the two HALs), so a
single snapshot set can't cover them. The runner already supports
`--backend=canvas2d|webgl|webgpu` and `--backend=all`, writing each set to its
own `__snapshots__/<backend>/` subdir (`snapshotConfig.snapshotsDir`), with
`compare-backends.ts` diffing them.

Historically the GPU backends rendered through **swiftshader** (software WebGL)
so the goldens were deterministic and CI-portable. But swiftshader's GPU-process
memory grows ~29 MB per WebGL context and is never returned to the OS (proven in
`agent-docs/guides/TEST_INFRASTRUCTURE.md` § "Cross-test memory growth is SwiftShader"),
which OOM-killed long runs. On a
real GPU the growth is gone (flat). The team chose to run the browser tests only
on machines with a real GPU.

## Decision

1. **Every snapshot lives under a per-backend subdir** — `__snapshots__/canvas2d/`,
   `__snapshots__/webgl/`, `__snapshots__/webgpu/`. There are **no loose
   snapshots at the `__snapshots__/` root**; the default (no `--backend`) run is
   not a golden set, because "whatever Chrome auto-picks" is machine-dependent
   and ambiguous.

2. **GPU backends render on the real GPU, headed.** `--backend=webgl` no longer
   forces swiftshader (the `--use-angle=swiftshader` flags were removed); it runs
   on the machine's real GPU via headed Chrome. `--backend=canvas2d` keeps
   `--disable-gpu` (it is CPU rasterization and inherently deterministic, so it
   can run headless with no visible window).

3. **Goldens are local-only, not CI-portable.** Real-GPU output is specific to
   the GPU/driver that produced it, so these goldens are not expected to
   reproduce on another machine or on GPU-less CI. The browser tests were
   removed from GitHub Actions for this reason (see push.yml). This is an
   accepted trade: correctness verification happens on a developer's real GPU.

## Backend details

| Backend  | Browser         | GPU             | Headed | Notes |
| -------- | --------------- | --------------- | ------ | ----- |
| canvas2d | Chrome          | `--disable-gpu` | no     | CPU; deterministic |
| webgl    | Chrome          | real (ANGLE/GL) | yes    | was swiftshader |
| webgpu   | Firefox Nightly | real (Vulkan)   | yes    | Chrome can't |

WebGPU note: **webgpu must run through Firefox Nightly** under puppeteer.
Chrome + puppeteer does not render WebGPU canvases on a real GPU — it comes up
blank with Dawn adapter-validation errors (an undersized allocation that the
strict Chrome/Dawn path rejects but Firefox tolerates). `navigator.gpu` *does*
resolve a hardware adapter in Chrome (confirmed in a secure `http://localhost`
context — WebGPU is gated to secure contexts, so `about:blank` probes falsely
report it absent), but the rendered result is empty, so the runner keeps webgpu
on Firefox Nightly (the lavapipe/xvfb software path it originally used is
replaced by the machine's real Vulkan driver).

## Consequences

- `compare-backends.ts` / `--backend=all` remains the way to regenerate or diff
  the full matrix; each backend's recycle (per-test `browser.close()`) still
  caps any per-context growth.
- Re-recording goldens requires a real GPU; a contributor without one cannot
  regenerate them, only consume the committed set.

## Rejected alternatives

- **Keep swiftshader for deterministic/CI goldens.** Rejected: the team wants
  real-GPU fidelity and accepts local-only goldens; swiftshader's OOM growth and
  software-vs-hardware rendering gap outweigh portability here.
- **A single default-backend root set.** Rejected: "what Chrome auto-picks" is
  machine-dependent and conflates renderer paths; explicit per-backend dirs make
  each golden's provenance unambiguous.
