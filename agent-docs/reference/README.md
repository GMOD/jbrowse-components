---
name: reference-index
description: Index of every doc in reference/, with the question each one answers. Read this to find the right subsystem writeup instead of opening several.
---

# Reference index

Everything settled: how a subsystem works, how to operate it, and the datasets
behind the figures. Start from [ARCHITECTURE.md](../ARCHITECTURE.md) for how a
track renders; come here for the depth on one piece of it.

The table is generated from each doc's `description:` frontmatter by
`website/scripts/generate-reference-index.ts`, so a new doc joins it by carrying
the frontmatter every doc here already needs — and `pnpm autogen --check` fails
on one that doesn't. Don't edit between the markers; write the doc's
`description:` instead, since that line is also what a reader sees when they
`ls` and grep the directory.

<!-- BEGIN GENERATED REFERENCE INDEX -->

| Doc | Read when |
| --- | --- |
| [architectural-limits](ARCHITECTURAL_LIMITS.md) | Live register of the architecture's resource ceilings, accepted couplings, and correctness surfaces nothing mechanical protects. Each entry carries its mitigation state and the condition that retires it. Read before scaling work (many tracks, many views, whole-genome), or when a symptom looks like a product bug but is a ceiling. |
| [bp-precision](BP_PRECISION.md) | The absolute-uint32 coordinate convention, the three coordinate families the GPU renderers use, and genome-size limits. Read when writing a Slang shader or a CPU instance packer. |
| [clustering-workflow](CLUSTERING_WORKFLOW.md) | In-app hierarchical clustering for wiggle and variants. Read when touching cluster dialogs, dendrograms, or the TreeSidebar. |
| [compiler-ternary-finding](COMPILER_TERNARY_FINDING.md) | Why babel-plugin-react-compiler can stale a MobX read, and the patterns that avoid it. Read when writing observer components or custom hooks that read MobX, or debugging a stale MobX read. |
| [config-pattern](CONFIG_PATTERN.md) | How display config reaches the renderer, from config to MST snapshot to plain object to RPC payload. Read when touching config, JEXL callbacks, or RPC payloads. |
| [core-util-audit](CORE_UTIL_AUDIT.md) | The 2026-07-31 audit of packages/core/src/util — what landed, the latent typing/contract items still open, the dead code that is a plugin-ABI decision rather than a reachability question, and the list verified clean. Read before re-auditing core/util or deleting something there that looks unused. |
| [desktop-context-isolation](DESKTOP_CONTEXT_ISOLATION.md) | How to remove jbrowse-desktop's renderer privilege — what actually blocks the contextIsolation flip (the renderer bundle's static `fs` require, the `openLocation` funnel, the `isElectron` userAgent sniff), what a probe disproved, and the suggested order. Read before touching electron/window.ts or the desktop file-access path. |
| [desktop-screenshots](DESKTOP_SCREENSHOTS.md) | The selenium harness that drives the packaged Electron app to produce the desktop-*.png figures — why a code change needs a fresh package build first, how --only scopes a regen, how it decides a view is done loading, and the failure modes that are not bugs. Read before regenerating a desktop figure or reading a failed run. |
| [display-type-defaults](DISPLAY_TYPE_DEFAULTS.md) | Session-wide per-display-type slot defaults via promotable slots and CSS-cascade resolution. Read when adding a make-default-for-all-tracks setting, touching getConf / promotable slots, or serializing a session for sharing/export/worker. |
| [displaychrome](DISPLAYCHROME.md) | The shared display status chrome that owns loading, error, and retry UI, plus its adoption map. Read when touching loading/error/retry UI on a display. |
| [dog10k-datasets](DOG10K_DATASETS.md) | The Dog10K callsets, loci and measured recipes behind the local-ancestry, SV and LoF tutorials — which assembly everything is on, which VCF actually carries DUP/INV, how to compute per-sample copy number from the hosted CRAMs, and the gotchas that produce a plausible wrong answer. Read before adding a Dog10K locus or figure. |
| [eager-bundle](EAGER_BUNDLE.md) | What every JBrowse host downloads before it can run, why plugin registration makes most of it unavoidable, the six pins that were making it pay for far more, and the measured census of what still holds Material UI there. Read before touching a plugin `exports` object, a state model's imports, or anything that claims a bundle number. |
| [examples-sites](EXAMPLES_SITES.md) | The rule the four embeddable-product examples sites are built on — every shown example is one complete copy-pasteable file, so shared setup may not be factored out — plus the prose caps, generated artifacts and CI wiring all four share. Read before adding a page, or before "tidying up" the duplication in one. |
| [gpu-context-budget](GPU_CONTEXT_BUDGET.md) | The WebGL2 context ceiling is 16 and what reaches it — the "many-view freeze" and its 2026-06-19 fix, the shapes still exposed (one view with 17 GPU tracks, a multi-panel workspace), the software-rendering cost crossover, the headless/SwiftShader measurement trap, and the harness. Read before touching view windowing or proposing a fix for GPU-context churn. |
| [gpu-glossary](GPU_GLOSSARY.md) | A plain-language GPU rendering glossary and Canvas2D to GPU primer. Read when writing about GPU internals for a non-specialist audience. |
| [gpu-rendering](GPU_RENDERING.md) | The GPU render lifecycle in depth — RenderLifecycleMixin, the upload/render autoruns, per-plugin backends, the three upload patterns, the HAL, and Slang shaders. Read when touching a rendering backend, an upload path, or a shader. |
| [historical](HISTORICAL.md) | Bugs that shaped the current design and corrections to old writeups. Read to understand why something is not done the obvious way, or to avoid a known-bad fix. |
| [maf-cross-view-navigation](MAF_CROSS_VIEW_NAVIGATION.md) | Design for jumping from a MAF row to that species' own genome in a new view. The plugin stays portal-agnostic; the sample→assembly table is precomputed by whoever builds the config. Read before adding species navigation to plugins/maf. |
| [maf-large-blocks](MAF_LARGE_BLOCKS.md) | Why a MAF-tabix track with very long alignment blocks is slow and can crash, why "clip to the visible region" is the wrong fix, and the three options that are not. Read before touching MafTabixAdapter fetch cost or proposing block clipping. |
| [network-abort](NETWORK_ABORT.md) | How cancellation actually reaches the socket — the two mechanisms behind one stop token, which adapters are wired and which two readers cannot be, the shared-fetch coalescing trap, and the measured bandwidth a cancel saves. Read before touching stopToken, an adapter's read path, or proposing an abort protocol. |
| [pangenome-graphs](PANGENOME_GRAPHS.md) | How a graph reaches JBrowse — what rGFA and plain GFA can and cannot say about coordinates and carriage, the one-node-per-bubble level of detail, ceilings measured on the hosted HPRC index, and the decisions that look like bugs and are not. Read before touching a graph adapter, a pangenome figure, or a linearized-variation lane. |
| [perf-instrumentation](PERF_INSTRUMENTATION.md) | Instrumentation patterns for GPU render and scroll jank. Read when diagnosing a perf regression. |
| [plugin-abi-stability](PLUGIN_ABI_STABILITY.md) | Why plugin exports ossify into permanent ABI, and the fixes. Read when removing or renaming a plugin export. |
| [progress-reporting](PROGRESS_REPORTING.md) | The worker to UI status channel via statusCallback, determinate bars, concurrent-fetch aggregation, and cancel. Read when touching a progress bar or download loop. |
| [region-too-large](REGION_TOO_LARGE.md) | The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner. |
| [region-view-launch](REGION_VIEW_LAUNCH.md) | Launching another view type on a locus (synteny stack, graph subgraph) from a linear view. The shared convention, where the two launchers diverge, and what is still open. Read before adding a "open view X for this region" entry point. |
| [rfc-001-community-plugin-api](RFC-001-community-plugin-api.md) | The community plugin API proposal. Read when doing plugin API design. |
| [row-height-and-fit](ROW_HEIGHT_AND_FIT.md) | The shared two-valued row-height convention every multi-row display implements — the `rowHeight` slot whose `0` means fit-to-height, the resolved `effectiveRowHeight` getter that is a cross-plugin ABI, the shared menu row and dialog in tree-sidebar, and the two places a display legitimately differs. Read before adding a row-height setting or a fit-to-height mode. |
| [screenshot-callout-anchors](SCREENSHOT_CALLOUT_ANCHORS.md) | How a screenshot callout or a driven click resolves its position at capture time, the four things about that resolution the types don't tell you, and how to convert a hand-placed coordinate into an anchor by measuring the committed PNG instead of re-rendering. Read before placing a callout, converting one, or diagnosing a figure whose annotation landed in the top-left corner. |
| [screenshot-capture-race](SCREENSHOT_CAPTURE_RACE.md) | The three ways a screenshot disagrees with what the app drew — the website generator's empty-canvas race, the browser-test blank where el.screenshot() and toDataURL disagree, and the band of app chrome that appears when el.screenshot() scrolls the element under a sticky header in one browser and not the other. Read before diagnosing an "empty painting" as a data problem or a cross-backend band as a render bug. |
| [screenshot-perf](SCREENSHOT_PERF.md) | Why heavy screenshot specs take minutes (software rasterization, not app code), how that was established, and what is still open. Read before "optimizing" a slow figure or raising its timeouts. |
| [shader-js-codegen](SHADER_JS_CODEGEN.md) | How to add a function to the `//! js-export` set, retire its hand-written twin, and bump SLANG_VERSION safely — plus the emitter facts that cost a session each to establish. Read before adding an export or extending wgslToJs.ts. |
| [slang-uniform-arrays](SLANG_UNIFORM_ARRAYS.md) | How to declare an indexed palette in a uniform block, and why it must be float4[N] and never a scalar array — slangc v2026.5.2 segfaults on the scalar form for WGSL with no diagnostic. Read before adding an array uniform, or when gen:shaders dies on a signal with no message. |
| [sv-multihop](SV_MULTIHOP.md) | How scripts/sv_multihop.py reconstructs a derivative allele from a somatic SV callset plus the tumour reads, the four silent-wrong-answer bugs now pinned by behavior checks, and the COLO829/K562 facts the cancer_sv tutorial rests on. Read before touching the cancer_sv figures or the derivative-allele reconstruction. |
| [svg-export](SVG_EXPORT.md) | SVG export pipeline covering the renderSvg shape, the svgReady/settled readiness gates, paintLayer, and clip ids. Read when touching a display's renderSvg or export readiness. |
| [synteny-lod](SYNTENY_LOD.md) | The two PIF tiers (fine/coarse), the profiled cost model, and why read-time binning is capped at ~1.5x. Read before touching make-pif, the indexed PIF adapters, or the synteny fetch RPC. |
| [test-infrastructure](TEST_INFRASTRUCTURE.md) | Browser and unit tests and WebGPU CI. Read when running or writing tests, or validating RPC. |
| [toolchain](TOOLCHAIN.md) | Why we deliberately run TypeScript 6.x for lint and an aliased typescript7 for typecheck and build:esm, why unifying them breaks the eslint backstop, plus the project-reference, module-augmentation and clean-tree rules that follow. Read before changing a TypeScript version, a tsconfig references array, or a package entry point. |
| [track-selector-perf](TRACK_SELECTOR_PERF.md) | Where the hierarchical track selector's cost actually is (rendering a row, not rebuilding the model), which three model-side optimizations were measured and rejected, and how to benchmark it without fooling yourself. Read before "optimizing" the track tree. |
| [view-init](VIEW_INIT.md) | The declarative init launch spec, afterAttach, and the view launch state machine. Read when touching view launch, URL params, or createViewState. |
<!-- END GENERATED REFERENCE INDEX -->
