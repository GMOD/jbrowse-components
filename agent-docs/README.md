# Agent documentation

Front door for agent work on the GPU rendering pipeline (formerly the
`webgl-poc` branch, now merged to `main`). This file holds the invariants and
definition of done; **backlog and priorities live in [TODO.md](TODO.md)**.

## Mission

Migrate JBrowse 2 from block-based HTML canvas rendering to a GPU pipeline
(WebGPU → WebGL2 → Canvas 2D; SVG export via Canvas 2D). Keep every existing
track type working on every backend.

## Non-negotiable invariants

Correctness contracts — violations cause silent bugs.

- **MST owns the upload + render autoruns.** They are spawned by
  `attachRenderingBackend` on `RenderLifecycleMixin`, not by React `useEffect`.
- **Per-region upload values must be freshly constructed, never mutated.**
  RenderingBackends diff by reference identity; in-place mutation leaks stale bytes.
- **Only write MST observables via actions.** Direct writes inside an autorun
  body (e.g. `self.canvasDrawn = true`, `self.maxY = x`) silently fail under MST
  action enforcement. Use the defined action.
- **Plugins define only `startRenderingBackend(backend)`.** Body is one
  `self.attachRenderingBackend(backend, {upload, render})` call. `canvasDrawn`,
  `renderNow`, `stopRenderingBackend`, tab-visibility rerender all live in the
  mixin.
- **Structural types across lazy boundaries.** Importing MST model types across
  lazy imports is a circular-reference trap — use duck-typed interfaces.
- **Shared backends (dotplot, synteny) use a per-plugin `lastKeys` closure** to
  fire `deleteGeometry` on removed keys; active-set prune would wipe sibling
  displays' data.
- **Render callback returns `false` to skip.** Any other return (including
  `void`) marks the canvas drawn via `markCanvasDrawn`.
- **`readConfObject` / `getConf` are hot-path traversals.** Cache outside loops;
  prefer `getConfSnapshot` + `readConfigValue` on plain objects at the rendering
  layer (`reference/CONFIG_PATTERN.md`).

Coding conventions live in `CLAUDE.md` (root) and `~/.claude/CLAUDE.md`.

## Where the code lives

Verify against source, not memory.

| Concern                     | Path                                                     |
| --------------------------- | -------------------------------------------------------- |
| GPU primitives / HAL        | `packages/render-core/src/hal/`                          |
| Lifecycle mixin             | `packages/render-core/src/RenderLifecycleMixin.ts`       |
| Shader codegen              | `packages/shader-tools/src/build-shaders.ts` (`pnpm gen:shaders`), `packages/shader-tools/src/shader-codegen/` |
| Shared slang modules        | `packages/render-core/src/shaders/`                      |
| Browser tests               | `products/jbrowse-web/browser-tests/`                    |
| Canvas display              | `plugins/canvas/`                                        |
| Wiggle / multi-wiggle       | `plugins/wiggle/`                                        |
| Alignments + coverage       | `plugins/alignments/`                                    |
| Variants + variant matrix   | `plugins/variants/`                                      |
| HiC / LD                    | `plugins/hic/`, `plugins/variants/` (matrix + LD)        |
| Dotplot                     | `plugins/dotplot-view/`                                  |
| Linear synteny              | `plugins/linear-comparative-view/`                       |

## Definition of done

- **Type check** the touched packages (`pnpm tsc -b` scoped), full project once
  locally.
- **Unit tests** for changed paths (`pnpm test <path>`).
- **Browser test** when UI behavior changed, on the backend(s) you touched
  (`node --experimental-strip-types browser-tests/runner.ts --filter=<suite>`;
  flags in `guides/TEST_INFRASTRUCTURE.md`).
- **Lint** with `--cache --fix` on changed files.
- **Snapshots** regenerated only after intentional, visually verified change
  (`--update-snapshots`).
- **Invariants** preserved — re-read the invariants above after lifecycle or
  upload changes.

Do **not** open a PR (`gh pr create`) unless explicitly asked.

## Docs

Deep how-it-works references live in **[reference/](reference/)**, operational
how-tos in **[guides/](guides/)**, and design rationale in
**[architecture-decision-records/](architecture-decision-records/)**.

### Start here

| Doc                                     | Purpose                                                     | When to read                                  |
| --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **[TODO.md](TODO.md)**                  | Action items to build/fix (backlog)                         | Picking up work                               |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**    | Future / exploratory concepts + folded proposals, incl. block-level synteny import and request-abort (not current work) | Brainstorming, product direction |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**  | Canonical GPU lifecycle / shaders / HAL reference           | Touching a display, backend, or shader        |
| **[LAZY_DISPLAY_BEHAVIOR_PLAN.md](LAZY_DISPLAY_BEHAVIOR_PLAN.md)** | Design note: defer displays' interaction surface (menus/dialogs) out of the eager bundle via the MST fork's `extendInstance` (not implemented) | Bundle-size work on display models; considering lazy MST behavior |
| **[R_EXPORT_VISION.md](R_EXPORT_VISION.md)** | Vision: native-R figure export (not htmlwidget) via a language-neutral render IR — one brain, N pens — to close the reproducibility loop (not implemented; `R_export2` branch) | Working on R export; designing the render IR or SVG-export-through-IR |

### `reference/` — how the system works

| Doc                                                                          | Purpose                                                     | When to read                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **[SVG_EXPORT.md](reference/SVG_EXPORT.md)**                                 | SVG export pipeline: `renderSvg` shape, `svgReady`/`settled` gates, `paintLayer`, clip ids | Touching a display's `renderSvg.tsx` or export/capture readiness |
| **[BP_PRECISION.md](reference/BP_PRECISION.md)**                             | Absolute-uint32 convention, hi/lo float math, window-relative cumBp, genome-size limits | Writing a `.slang` shader or a CPU instance packer |
| **[PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md)**                 | Worker→UI status channel: `statusCallback`, determinate bars, concurrent-fetch aggregation, cancel | Touching a progress bar or a download/worker loop |
| **[HISTORICAL.md](reference/HISTORICAL.md)**                                 | Bugs that shaped the design + corrections to old writeups | "Why isn't it done the obvious way?" / avoiding a known-bad fix |
| **[CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md)**                         | Display config → MST snapshot → plain object → renderer     | Touching config, JEXL callbacks, RPC payloads |
| **[DISPLAY_TYPE_DEFAULTS.md](reference/DISPLAY_TYPE_DEFAULTS.md)**           | Session-wide per-display-type slot defaults (promotable slots, CSS-cascade resolve) | Adding a "make default for all tracks like this" setting; touching `getConfResolved` / `promotable` slots |
| **[VIEW_INIT.md](reference/VIEW_INIT.md)**                                   | Declarative `init` launch spec → afterAttach → state machine | Touching view launch, URL params, createViewState |
| **[DISPLAYCHROME.md](reference/DISPLAYCHROME.md)**                           | The shared display status chrome: what it is + adoption map | Touching loading/error/retry UI on a display  |
| **[GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md)**                             | Plain-language GPU rendering glossary + precise vocabulary   | Writing about GPU internals for a non-specialist audience |
| **[CLUSTERING_WORKFLOW.md](reference/CLUSTERING_WORKFLOW.md)**               | In-app hierarchical clustering (wiggle + variants)          | Touching cluster dialogs, dendrograms, TreeSidebar |
| **[PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md)**             | Why plugin exports ossify into permanent ABI + fixes (fleshes out RFC-001 §7) | Removing/renaming a plugin export; "why can't we delete this?" |
| **[RFC-001-community-plugin-api.md](reference/RFC-001-community-plugin-api.md)** | Community plugin API proposal                           | Plugin API design                             |

### `guides/` — operational how-tos

| Doc                                                                       | Purpose                                                     | When to read                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **[TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md)**               | Browser + unit tests, WebGPU CI                             | Running or writing tests, validating RPC      |
| **[PERF_INSTRUMENTATION.md](guides/PERF_INSTRUMENTATION.md)**             | Instrumentation patterns for GPU render / scroll jank       | Diagnosing a perf regression                  |
| **[SCREENSHOT_REVIEW_HANDOFF.md](guides/SCREENSHOT_REVIEW_HANDOFF.md)**   | Working the `bad`-status screenshot-review backlog (regen pipeline, hosted-track sources) | Fixing website screenshot specs / gallery figures |

### `architecture-decision-records/`

Design decisions (ADR-001 … ADR-035) — read to understand why something is the
way it is. **[architecture-decision-records/README.md](architecture-decision-records/README.md)**
indexes all of them by number, status, and one-line decision.

## Common questions

**"How do I add a new GPU display type?"** → `ARCHITECTURE.md` "Adding a new GPU
display type".

**"How do I debug failing browser tests?"** → `guides/TEST_INFRASTRUCTURE.md`
"Debugging".

**"Why does the worker get what it gets?"** → `reference/CONFIG_PATTERN.md` +
`ARCHITECTURE.md` §"The `rpcProps` / `gpuProps` pattern".

**"What invariants must I preserve?"** → "Non-negotiable invariants" above.

**"What should I work on?"** → `TODO.md`.
