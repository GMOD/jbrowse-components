# Architecture decision records

One decision per file — why something is the way it is, and what alternatives
were rejected. Read the relevant ADR before "simplifying" a design that looks
accidental; several record deliberate choices that a fresh eye would try to undo.

Statuses: **Accepted** (in force), **Rejected** (considered, not done — the ADR
records why *not*), **Superseded** (replaced; see the note), **Closed** (no
action needed under current workloads), **Proposed** (not yet decided).

<!-- BEGIN GENERATED ADR INDEX -->

| ADR | Status | Decision |
| --- | --- | --- |
| [001](adr-001-rpc-data-map-pattern.md) | Superseded | Keep `new Map()` reassignment pattern for volatile RPC data — superseded by ADR-017 (`rpcDataMap` is now `observable.map`) |
| [002](adr-002-variant-batch-rpc-and-inputkey-upload.md) | Superseded | The batch RPC held; the inputKey gate did not. `inputKey` exists nowhere — variants gate on reference identity like everything else, through render-core's createRegionUploadSync, which is the pattern ADR-004 declined to abandon |
| [003](adr-003-settings-invalidation-pattern.md) | Superseded | Settings-invalidation autorun pattern for withFetchLifecycle displays — mechanism replaced by the `rpcProps()`-reading `SettingsInvalidate` autorun; preserve-vs-clear revised by ADR-006 |
| [004](adr-004-inputkey-upload-gate.md) | Rejected | Keep reference-identity upload gate; don't adopt inputKey pattern universally |
| [005](adr-005-shader-codegen-slang.md) | Accepted | Author shaders in Slang, cross-compile to WGSL/GLSL + generate TS layout |
| [006](adr-006-preserve-stale-rpc-data-across-refetch.md) | Accepted | Preserve stale `rpcDataMap` through a refetch |
| [007](adr-007-global-data-display-mixin.md) | Accepted | `GlobalDataDisplayMixin` — fetch lifecycle for monolithic-dataset GPU displays |
| [008](adr-008-wiggle-strict-bpperpx-equality.md) | Accepted | Strict-equality `bpPerPx` cache check for wiggle |
| [009](adr-009-canvas-drawn-reliability.md) | Accepted | `canvasDrawn` reliability — backend-owned return and reset on invalidation |
| [010](adr-010-synteny-dotplot-pixel-offsets.md) | Superseded | Synteny/dotplot pre-projected pixel offsets — superseded by ADR-067 for both paths |
| [011](adr-011-canvas-flatbush-immutable-offsets.md) | Rejected | Canvas flatbushItem/subfeatureInfo stay mutable; reject parallel offset arrays |
| [012](adr-012-synteny-worker-output-split.md) | Accepted | Synteny worker emits geometry only; main thread owns colors and picking IDs (picking part superseded by ADR-019) |
| 013–015 | Removed | Graph-genome ADRs (bubble shape, chain contraction, cross-path symmetry) — deleted with `graph-core`; numbers not reused |
| [016](adr-016-bicolorpivot-stays-in-worker.md) | Accepted | `bicolorPivot` split stays in the worker, not `gpuProps` |
| [017](adr-017-wiggle-per-key-autoruns.md) | Superseded | Per-region streamed wiggle upload uses per-key autoruns — superseded by ADR-078, which keeps the O(1)-per-arrival property with one autorun and a reference diff |
| [018](adr-018-synteny-cumbp-hpmath-storage.md) | Superseded | Synteny corner storage moves to cumulative-bp hi/lo Float32 — superseded by ADR-067 (window-relative Float32) |
| [019](adr-019-synteny-cpu-picking.md) | Accepted | Synteny picking moves from GPU framebuffer readback to CPU (supersedes ADR-012 picking) |
| [020](adr-020-wiggle-line-plot-encoding.md) | Accepted | Wiggle line-plot single-polyline encoding |
| [021](adr-021-getfeaturearrays-stays-duck-typed.md) | Accepted | Wiggle adapter fast path stays duck-typed; bicolor split lives at the executor |
| [022](adr-022-no-batched-wiggle-rpc.md) | Superseded | Reversed — wiggle now batches every visible region into one RPC, because the adapter can coalesce adjacent on-disk blocks across region boundaries, which this ADR priced at zero. The dispatch-overhead reasoning below was right and was never the deciding term |
| [023](adr-023-synteny-per-instance-pad-memory.md) | Superseded | Per-instance pad memory — no action; moot since ADR-067 removed per-instance padding entirely |
| [024](adr-024-per-backend-snapshots-real-gpu.md) | Accepted | Browser-test snapshots are per-backend, rendered on a real GPU, run locally |
| [025](adr-025-gpu-canvas-stays-mounted-not-xor-error.md) | Superseded | GPU canvas stays mounted across error/retry — superseded by the DisplayChrome unification |
| [026](adr-026-displaychrome-layering-stays.md) | Accepted | DisplayChrome's layering stays — the split maps to concern boundaries |
| [027](adr-027-wheel-input-semantics.md) | Accepted | Wheel-input semantics stay per-handler — a unified resolver is relocation, not simplification |
| [028](adr-028-tooltip-clientpoint-vs-pointer-tracking.md) | Accepted | Hover tooltips pass a controlled `clientPoint`; floating-ui pointer-tracking is opt-in |
| [029](adr-029-managed-embedded-components.md) | Proposed | Managed embedded React components (uncontrolled, init-driven) |
| [030](adr-030-render-core-package-static-import-only.md) | Accepted | Extract `@jbrowse/render-core`; GPU rendering API is static-import-only |
| [031](adr-031-track-config-hydration-cache-on-pluginmanager.md) | Accepted | Frozen-track hydration cache lives on `PluginManager`, not a module-level singleton |
| [032](adr-032-track-config-nodes-are-throwaway-views.md) | Accepted | Hydrated track-config MST nodes are throwaway views, not authoritative state |
| [033](adr-033-synteny-lod-prune-at-data-draw-crisp-at-shader.md) | Accepted | Synteny/dotplot LOD — prune at the data layer, draw survivors crisp at the shader |
| [034](adr-034-dotplot-diagonalize-stays-single-axis.md) | Accepted | Dotplot/synteny auto-diagonalize stays single-axis; both-axis seriation rejected |
| [035](adr-035-pileup-maxheight-bounds-pixels-not-gpu-memory.md) | Closed | `maxHeight` bounds pixels, not GPU instance count — no action |
| [036](adr-036-delete-stranded-pluggable-glyph-registry.md) | Accepted | Delete the stranded pluggable glyph registry; glyph extensibility reopens worker-side or not at all |
| [037](adr-037-two-collapse-mechanisms.md) | Accepted | Two "collapse" mechanisms stay distinct — automatic sub-pixel density-collapse vs. explicit `displayMode: 'collapsed'`; don't auto-select the preset for dense data |
| [038](adr-038-desktop-plugin-trust-at-fetchconfig-funnel.md) | Accepted | Desktop vets remote-config plugins at the `fetchConfig` funnel, not per caller; mitigation until contextIsolation |
| [039](adr-039-synteny-no-read-time-binning.md) | Accepted | No read-time binning for synteny/PIF (optimizes the wrong end); the N→M lever is a deferred `make-pif` binned tier, not a region gate |
| [040](adr-040-no-genome-quad-vertex-helper.md) | Accepted | No shared genome-quad vertex helper; hpmath atoms are the right granularity and the composition on top is single-consumer |
| [041](adr-041-no-mixin-composed-into-basedisplay.md) | Rejected | Don't factor shared display state into a mixin composed at the BaseDisplay root — it exhausts MST's type-inference depth and silently drops later mixins' members |
| [042](adr-042-no-shared-assembly-swap-autorun-installer.md) | Superseded | Kept dotplot's and synteny's assembly-swap-check autoruns separate while a shared installer would have added mobx to synteny-core — superseded 2026-08 when the fetch skeleton brought mobx there anyway, which is the revisit condition this ADR named |
| [043](adr-043-rpc-workers-carry-ui-code.md) | Accepted | RPC workers parse 2.2 MB of MUI/react-dom they never run; the fix is blocked on splitting every plugin index's model half from its React half, so we measure it and take smaller wins instead |
| [044](adr-044-reactive-display-hooks-are-getters-or-pinned-views.md) | Accepted | Reactive display hooks are getters where possible, pinned views where not — an `.actions()` block untracks them silently |
| [045](adr-045-region-too-large-gate-stays-in-lgv-plugin.md) | Rejected | The region-too-large gate does not move to `@jbrowse/render-core`; ADR-030 bars the dependency and the gate's only composers are plugin-side, so the export surface was cut in place instead |
| [046](adr-046-resolveconf-names-the-cascade.md) | Accepted | Promotable-slot resolution is named at the call site (`resolveConf`); `getConf` never cascades |
| [047](adr-047-undefined-is-the-only-inherit-sentinel.md) | Accepted | A promotable slot's inherit sentinel is always `undefined` (a `maybe*` type + `promotedBase`) — never an in-band `'inherit'` enum member or a doubled-up `defaultValue` |
| [048](adr-048-pin-edits-the-stylesheet-not-the-elements.md) | Accepted | Setting a display-type default writes only the session-wide value; rewriting tracks is a separate, explicitly-labeled, opt-in action |
| [049](adr-049-region-bound-wrapper-stays.md) | Accepted | Keep the per-read `RegionBoundBamFeature` wrapper — `recordClass` moved the wrapper from retained to transient, which is where the cost actually was; eliminating the transient one would change the adapter→extractor contract for ~1% |
| [050](adr-050-track-containers-are-not-view-types.md) | Accepted | A track list that is not a view is addressed by id through its view (`trackContainerFor`), not registered as a hidden view type |
| [051](adr-051-shader-js-codegen-is-scalar-only.md) | Accepted | Generate the Canvas2D twin of a shader's scalar decision functions from slangc's WGSL; never transpile the vertex or fragment stage |
| [052](adr-052-slot-name-safety-is-a-write-guard.md) | Accepted | Slot-name safety is a runtime guard on the single write funnel, not codegen extending a compile-time guard that structurally cannot cover the surface |
| [053](adr-053-alignments-layout-stays-on-the-main-thread.md) | Accepted | Pileup/chain row layout stays on the main thread; the packing cost it is blamed for is separable and is the thing to attack |
| [054](adr-054-comparative-displays-keep-their-own-fetch.md) | Rejected | The comparative displays don't compose `FetchMixin`; the third fetch shape is structural, and everything drift-prone they share with the LGV families is already shared as plain functions |
| [055](adr-055-mst-model-types-are-interfaces.md) | Accepted | Export MST model instance types as `interface X extends Instance<…> {}`, not `type X = Instance<…>` — the interface form is what lets a view and its display name each other |
| [056](adr-056-jbrowse-org-is-not-cross-origin-isolated.md) | Rejected | jbrowse.org stays non-isolated: the CloudFront header change is half an hour, but `COOP: same-origin` severs the OAuth popup handshake with no cross-browser way around it, and all isolation buys is the SharedArrayBuffer stop-token path that already benched at zero |
| [057](adr-057-dockview-stays-external.md) | Superseded | Decided four times that dockview stays; superseded by ADR-068, which replaced it. Kept for the part that held — every hard bug at the seam was ours — and for the cost estimate that did not, which was ~4x too high and was the thing deciding it |
| [058](adr-058-track-paint-containment-stays.md) | Accepted | Track paint containment stays; display chrome escapes the inter-region masks by portal, because the stacking context that blocks a z-index is the same thing that isolates the paint |
| [059](adr-059-the-raw-chunk-cache-is-the-long-tail-layer.md) | Accepted | RemoteFileWithRangeCache sweeps on idle rather than never, at fifteen minutes rather than the parsed caches' three, because it is the cheap layer and the one that still helps after they have expired; its 256 MB stays, because the workload that made it look oversized never pushed the layer above it past its own budget |
| [060](adr-060-region-data-maps-are-shallow-observable.md) | Accepted | Every per-region worker-payload volatile is built by render-core's `regionDataMap()`, which is a shallow `observable.map` — the deep enhancer's field-level atoms are unreachable given the never-mutate invariant, and it charges an observable-object rebuild per entry on insert plus a proxy hop per field read |
| [061](adr-061-webgl2-glsl-comes-from-the-regex-adapter.md) | Rejected | WebGL2 GLSL keeps coming from vulkanGlslToWebgl2.ts, not from -target spirv piped through SPIRV-Cross: the adapter absorbed fifteen new shaders in ninety days without one translation fix, and the WebGL-only bug it did have was a spec default SPIRV-Cross would have emitted too |
| [062](adr-062-base-colors-stay-named-uniforms.md) | Rejected | colorBaseA/C/G/T/N stay five named uniforms read under two index spaces rather than becoming one slot-indexed float4[N] palette: the naive conversion adds a second representation of a runtime-mutated color, and the full version moves the mismatch instance base field's meaning through the worker payload to delete two switches that are correct and tested |
| [063](adr-063-promotable-defaults-stay-read-time.md) | Accepted | the promotable display-type default cascade resolves at read time and is flattened only in outgoing snapshots; an apply-time model that writes promoted values into open tracks would destroy revert-on-clear |
| [064](adr-064-parsed-chunk-budgets-are-per-worker-not-per-file.md) | Accepted | @gmod/bam, @gmod/tabix and @gmod/cram each bound their parsed-chunk cache per file, and dataAdapterCache holds one file per open track, so the ceilings multiplied by track count with nothing bounding the sum — three deep alignments tracks browsing eight windows retained 1109 MB with every cache still well under its own 1 GB ceiling; the adapters now share one SharedBudget per JS context, in two of them because bytes and records cannot be summed |
| [065](adr-065-display-readiness-selectors.md) | Accepted | Display readiness is a data attribute and `data-testid` no longer mutates — the `-done`/`_done` suffix was an internal convenience that never reached the published contract, and its one ergonomic advantage came back as a helper that reports which half of the wait failed |
| [066](adr-066-callback-slots-are-read-raw-at-the-call-site.md) | Accepted | A config slot holding a `jexl:` callback is forwarded by reading it raw (`self.conf.slot`) at the call site — the reader was NOT changed to skip evaluation on an arg-less read, because that changes plugin-ABI semantics for every caller to fix two |
| [067](adr-067-synteny-dotplot-window-relative-float32.md) | Accepted | Synteny and dotplot corners are window-relative Float32 against a fetch-time base (supersedes ADR-010 and ADR-018) |
| [068](adr-068-workspace-layout-is-an-mst-tree.md) | Accepted | The workspace layout is one MST tree that React renders; dockview is gone. Supersedes ADR-057, whose ~8-9k-line estimate against this was about four times too high and was the thing holding the decision |
| [069](adr-069-detach-do-not-destroy-what-react-may-hold.md) | Accepted | An MST node React may still be rendering is detached, never destroyed in place. Destroying it is what turned a plugin install into a white page, and no deferral is provably long enough |
| [070](adr-070-viewport-is-a-stored-window.md) | Accepted | The LGV viewport persists as a bp window, not as offsetPx/bpPerPx |
| [071](adr-071-a-status-phase-must-outlive-the-window.md) | Accepted | Every RPC status write goes through the one throttle window, the phase-end clear included, so a phase shorter than the window never paints |
| [072](adr-072-only-one-phase-at-a-time-is-summable.md) | Accepted | aggregateStatus sums only the concurrent operations in the same phase; the rest are charged as unmeasured |
| [073](adr-073-delegated-member-blocks-are-followed.md) | Accepted | A model's `.views(sharedViews)` link is followed to the declaration behind it, so a model file can be split by MEMBER and not only by member BODY — and a block the generator cannot follow is fatal rather than silent |
| [074](adr-074-force-load-is-one-boolean-per-track.md) | Accepted | Force-load is a single per-track boolean, not a per-region per-axis ceiling — every question a raised ceiling had to answer was unanswerable, and four of them shipped as bugs |
| [075](adr-075-the-isoform-cap-runs-in-the-worker.md) | Accepted | The per-gene isoform cap collapses in the worker's layoutSubfeatures and puts the expanded-gene set in the RPC cache key, reversing the main-thread design the parked canvas-glyph proposal argued for — the worker→main boundary carries no isoform structure to relayout over |
| [076](adr-076-a-shared-canvas-answers-readiness-twice.md) | Accepted | The comparative views answer readiness twice — a per-display phase for "still working" and the surface `settled` gate for "finished content" — because an error is terminal to one and not the other |
| [077](adr-077-format-guessing-is-a-table-plus-the-adapter-registry.md) | Accepted | One format table both the app and the CLI read, and the adapter registry — not a per-plugin registration — decides whether a build can open a format |
| [078](adr-078-one-upload-autorun-and-a-diff.md) | Accepted | Per-region streamed upload is one autorun over the map plus a reference diff, not an autorun per key |
| [079](adr-079-a-display-installs-a-lifecycle.md) | Accepted | A display installs one of three rendering lifecycles; nothing outside render-core calls attachRenderingBackend, and the setup thunk is what makes the once-only semantics structural |
| [080](adr-080-a-phase-ends-when-it-stops-reporting.md) | Accepted | A fan-out slot retires a phase on any status that is not that phase moving forward, credits it once, and never blanks the shared label |
<!-- END GENERATED ADR INDEX -->
