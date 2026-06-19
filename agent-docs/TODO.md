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


## Coloring

Swap order in colo829


## links for color by strand, PUR


## treesidebar



1. Halo color is hardcoded to '#fff' — on a dark theme this would look like a stray white smudge instead of blending in. Should use theme.palette.background.default (or .paper) instead so it adapts to light/dark themes.
2. Hit area is still only 4px wide, same as before — visibility is better now but grabbing it precisely is still fiddly compared to the alignments/maf handles which use a wider band. Could widen to 6-8px without changing the visible line width.
3. Same hover-only invisibility pattern exists in MafCoverageResizeHandle.tsx and PileupComponent.tsx's resizeHandle/PileupResizeHandle — if those are also hard to spot over colored read/coverage bars, the same permanent-line treatment could be factored into the shared ResizeHandle (or a shared variant) rather than duplicated per call site.

## vendor electron-updater







## Fused abortsignal+stoptoken?

## Still need ultralong read cache?

