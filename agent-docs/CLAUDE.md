# Agent documentation

Front door for work on the rendering pipeline. Backlog lives in
[TODO.md](TODO.md); coding conventions in the root `CLAUDE.md`.

## Non-negotiable invariants

Violations cause silent bugs, not crashes.

- **MST owns the upload + render autoruns**, spawned by
  `attachRenderingBackend` on `RenderLifecycleMixin` — never a React
  `useEffect`. A plugin defines only `startRenderingBackend(backend)`, whose
  body is one `attachRenderingBackend(backend, { upload, render })` call.
- **The render callback returns `true` only when real content was drawn.** The
  mixin does `if (cbs.render(b)) markCanvasDrawn()`, so a falsy return —
  including an accidental `void` — leaves `canvasDrawn` false and the loading
  scrim up.
- **Per-region upload values must be freshly constructed, never mutated.**
  Backends diff by reference identity; in-place mutation leaks stale bytes.
- **Only write MST observables via actions.** A direct write inside an autorun
  body (`self.canvasDrawn = true`) silently fails under action enforcement.
- **Shared backends (dotplot, synteny) diff through `createKeyedUploadSync`**,
  which deletes each departed key individually; an active-set prune (what
  `createRegionUploadSync` does for a single display) would wipe a sibling
  display's data.
- **Structural types across lazy boundaries.** Importing MST model types across
  a lazy import is a circular-reference trap — use duck-typed interfaces.
- **`readConfObject` / `getConf` are hot-path traversals.** Cache outside loops;
  at the rendering layer prefer `getConfSnapshot` + `readConfigValue`
  ([CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md)).

## Definition of done

Type check the touched packages, unit tests for changed paths
(`pnpm test <path>`), a browser test when UI behavior changed
([TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md)), `pnpm lint --fix`.
Regenerate snapshots only after a visually verified change.
Re-read the invariants above after any lifecycle or upload change.

Do **not** open a PR unless asked.

## Docs

**[ARCHITECTURE.md](ARCHITECTURE.md)** is the canonical reference — display
stacks, the worker→main fetch pipeline, SVG export, invariants. Start there.

`reference/` — how the system works:

- [ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) — live register of resource ceilings, accepted trades, and unprotected correctness surfaces. Read before scaling work
- [GPU_RENDERING.md](reference/GPU_RENDERING.md) — render lifecycle, backends, upload patterns, HAL, Slang shaders
- [SVG_EXPORT.md](reference/SVG_EXPORT.md) — `renderSvg` shape, `svgReady`/`settled` gates, `paintLayer`, clip ids
- [BP_PRECISION.md](reference/BP_PRECISION.md) — absolute-uint32, hi/lo float math, genome-size limits
- [REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md) — the byte/density gate and fetch hold-off
- [PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md) — worker→UI status channel, cancel
- [DISPLAYCHROME.md](reference/DISPLAYCHROME.md) — shared loading/error/retry chrome
- [CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md) — config → MST snapshot → plain object → renderer
- [DISPLAY_TYPE_DEFAULTS.md](reference/DISPLAY_TYPE_DEFAULTS.md) — promotable slots, session-wide defaults
- [SYNTENY_LOD.md](reference/SYNTENY_LOD.md) — the two PIF tiers and the cost model
- [CLUSTERING_WORKFLOW.md](reference/CLUSTERING_WORKFLOW.md) — in-app hierarchical clustering
- [VIEW_INIT.md](reference/VIEW_INIT.md) — `init` launch spec → afterAttach → state machine
- [COMPILER_TERNARY_FINDING.md](reference/COMPILER_TERNARY_FINDING.md) — how react-compiler stales a MobX read
- [GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md) — plain-language GPU vocabulary
- [PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md) — why plugin exports ossify into ABI
- [RFC-001](reference/RFC-001-community-plugin-api.md) — community plugin API proposal
- [HISTORICAL.md](reference/HISTORICAL.md) — bugs that shaped the design; read before "fixing" something odd

`guides/` — operational how-tos:

- [TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md) — browser + unit tests, WebGPU CI
- [TOOLCHAIN.md](guides/TOOLCHAIN.md) — why `typescript` 6.x and `typescript7` coexist
- [PERF_INSTRUMENTATION.md](guides/PERF_INSTRUMENTATION.md) — diagnosing render / scroll jank
- [CONFIG_WRITE_PATH_HANDOFF.md](guides/CONFIG_WRITE_PATH_HANDOFF.md), finishing the raw `setSlot` to typed `setConf` migration
- [SCREENSHOT_REVIEW_HANDOFF.md](guides/SCREENSHOT_REVIEW_HANDOFF.md) / [SCREENSHOT_CAPTURE_RACE.md](guides/SCREENSHOT_CAPTURE_RACE.md) — website figure pipeline
- [DESKTOP_SCREENSHOTS.md](guides/DESKTOP_SCREENSHOTS.md) — the `desktop-*.png` selenium harness: readiness gates, capture size, what still breaks
- [DESKTOP_CONTEXT_ISOLATION.md](guides/DESKTOP_CONTEXT_ISOLATION.md) — desktop IPC, preload, plugin loading
- [REGION_VIEW_LAUNCH.md](guides/REGION_VIEW_LAUNCH.md) — "open view X for this region" entry points (synteny stack, graph subgraph)
- [PANGENOME_PATHS_HANDOFF.md](guides/PANGENOME_PATHS_HANDOFF.md) — per-haplotype graph paths as a linear track, the indel-glyph passes, `--call` traps
- [TAFFY_INDEX_GAPS_HANDOFF.md](guides/TAFFY_INDEX_GAPS_HANDOFF.md), a MAF block is indexed on row 0 alone, so a repeat-collapsed block hides its other reference copies. Why the pggb demo moved off taffy to `MafTabixAdapter`
- [GENERAL_GFA_HANDOFF.md](guides/GENERAL_GFA_HANDOFF.md) — anchoring a plain (pggb/odgi) GFA from its P/W lines instead of rGFA tags, which also makes sample rows real carriage rather than build order

[architecture-decision-records/](architecture-decision-records/README.md) — why
something is the way it is, indexed by number and status. That index is
generated from each ADR's `status` / `summary` frontmatter: add or re-status an
ADR, then run `pnpm gen-adr-index` (CI checks it).

Non-obvious code locations: shader codegen is
`packages/shader-tools/src/build-shaders.ts` (`pnpm gen:shaders`), shared Slang
modules are `packages/render-core/src/shaders/`, browser tests are
`products/jbrowse-web/browser-tests/`, and `example-plugins/score-example/` is
the guide's worked example — packed and installed by
`component_tests/plugin-vite/`, never published.
