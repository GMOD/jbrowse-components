 - no click and drag lgv scroll when on bookmark icon
 - make small samplot show at least 1px wide?
 - make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
 - aggressively refactor generate-screenshots
- group by strand plugins/canvas


## astro migration for storybooks


1. products/jbrowse-react-linear-genome-view/examples-site/MIGRATION.md — the actual handoff doc, checked into the repo where the reference implementation lives. Covers: POC status, why this approach, the validated single-source-of-truth pattern, open architectural decisions (per-ref deploy base path, routing, CGV/react-app needing their own examples-site/), a full inventory of all ~63 story exports to migrate across LGV/react-app/CGV, the verification approach (no playwright available — use @jbrowse/browser-test-utils's Puppeteer helpers), and a removal checklist for the old Storybook configs/CI/docs links.
2. Memory entry (project-storybook-to-astro-examples.md, indexed in MEMORY.md) — a short pointer so a future session recalls this is active and goes straight to MIGRATION.md instead of re-deriving the plan.


## alignments track alignment with architecture.md

1. Add a regression test for the exact bug class (most valuable). The parity tests cover coverage geometry and the sync rebuild transaction, but nothing asserts renderBlocks returns true for a coverage-only or arcs-only section with an empty pileup band — which is precisely the read-cloud case that flipped canvasDrawn to never-true. That invariant is now isolated in drawSection's return value, so it's trivially unit-testable. Locking it down means this can't silently regress again.

2. this.regions is a known architectural deviation. packages/render-core/CLAUDE.md explicitly says renderers should stay stateless and delegate buffer lifecycle to hal.pruneRegions(active), reading per-region data from the model's map. This renderer instead keeps a parallel Map and hand-prunes it in sync() (the manual activeSet loop). The two tracking systems can desync — exactly the category of "alarming" bug you hit. It's a bigger refactor (touches the model + renderBlocks signature), but it'd remove a whole class of bug. Worth doing deliberately, not now.



I checked the Canvas2D backend first: it also keeps a this.regions map built in sync() (a "thin shell" sharing a pure builder with SVG export). So the render-core "stateless renderer" guidance targets the simple single-pass renderers — the alignments display deliberately keeps a per-section region map in both backends. Making only the GPU one stateless would desymmetrize them and is a large unverifiable change (interface + model + Canvas2D + SVG). I did not do that.

What I did instead targets the actual fragility — the GPU sync() mutated-and-manually-pruned (active array + activeSet delete loop), the dual-tracking that can desync. Canvas2D just rebuilds wholesale. Now the GPU sync() does too: this.regions.clear() up front, and the manual prune + active bookkeeping are deleted. HAL buffer lifecycle was already handled by beginUpload/endUpload, so the prune was redundant; removing it makes a stale region impossible by construction. The two existing "buffer drops out" tests still pass (they assert on HAL buffer counts, which endUpload owns).

## Add prefix to autogen docs

Help organize things

## Scatterplot multiwiggle

Check why https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-wf0KdUtw3b&password=n8LDU
didn't load overlapping scatterplot

## Coloring

Swap order in colo829



## Reset resolution

Why checkbox

## Not loading compact or small feature height from https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-WmmP_Ac-iD&password=54jn1

Check




## Progress

long time 'computing sample info'...any more fine grained progress? Any indicator that it is 'doing too much' e.g. to cancel it also?



## Protein viewer

Compactify header more

Thinner tracks

## links for color by strand, PUR

## Update docs: have live link for everything


## config model testing

we saw an issue with ldheatmap giving error

 ldheatmap display is producing Fetch failed: DOMException: Proxy object could not be cloned.
      call webpack://@jbrowse/web/../../packages/core/src/rpc/RpcClient.ts?:108
      call webpack://@jbrowse/web/../../packages/core/src/rpc/RpcClient.ts?:103
      call webpack://@jbrowse/web/../../packages/core/src/rpc/WebWorkerRpcDriver.ts?:36
      transport webpack://@jbrowse/web/../../packages/core/src/rpc/WorkerPoolRpcDriver.ts?:94
  FetchMixin.ts:125:19
      runFetch webpack://@jbrowse/web/../../plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts?:125
      MobX 7

  the diagnosis:


Root cause: LDDisplay's jexlFilters getter (plugins/variants/src/LDDisplay/shared.ts:219-221) returned the live MST/MobX-observable array straight from getConfWithOverride('jexlFilters'). That getter intentionally returns the raw config value (for referential stability — see ConfigOverrideMixin.ts:138-142) rather than a snapshot, since most callers read scalar slots. jexlFilters is the only stringArray-typed slot read this way, and the resulting MST array (a Proxy) was passed directly into the RenderLDData RPC payload (rpcProps()) and failed postMessage's structured clone.
plugins/linear-genome-view/src/BaseLinearDisplay/models/ConfigOverrideMixin.test.ts

1. Nested-submodel slots — the real risk wasn't another clone error, it'd be getSnapshot silently freezing un-evaluated jexl strings if any getConfWithOverride call targeted a nested config sub-model. Checked every slot key used across every call site against its schema definition — the only frozen-typed ones (colorBy/filterBy in alignments) are already plain JS, not MST nodes, so isStateTreeNode correctly skips them. No nested-model case exists today.
2. Test coverage gap — ConfigOverrideMixin.test.ts existed but never exercised getConfWithOverride at all, only getOverride/setOverride. That's the exact function I changed, in shared infra used by every linear display. I added 4 tes-wins,


## treesidebar



1. Halo color is hardcoded to '#fff' — on a dark theme this would look like a stray white smudge instead of blending in. Should use theme.palette.background.default (or .paper) instead so it adapts to light/dark themes.
2. Hit area is still only 4px wide, same as before — visibility is better now but grabbing it precisely is still fiddly compared to the alignments/maf handles which use a wider band. Could widen to 6-8px without changing the visible line width.
3. Same hover-only invisibility pattern exists in MafCoverageResizeHandle.tsx and PileupComponent.tsx's resizeHandle/PileupResizeHandle — if those are also hard to spot over colored read/coverage bars, the same permanent-line treatment could be factored into the shared ResizeHandle (or a shared variant) rather than duplicated per call site.

## vendor electron-updater



## stuck downloading alignments

https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-sgi_pQ7gMw&password=VcJbT

also investigate slowness
