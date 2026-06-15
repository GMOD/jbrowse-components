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

## Cluster

No cluster by row when overlapping

## Reset resolution

Why checkbox

## Not loading compact or small feature height from https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-WmmP_Ac-iD&password=54jn1

Check

## Tooltip on breakpoint split view bezier

Check

## Share link for methylation not loading

https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-VG6GwCJP6B&password=9tmtk


## Data clone error

DataCloneError: Proxy object could not be cloned.

from https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-MDNPnGjRM-&password=90Fts

long time 'computing sample info'...any more fine grained progress? Any indicator that it is 'doing too much' e.g. to cancel it also?


## No resize bar on tree sidebar...


## Not phased link

https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-7Bxg2u78GE&password=QFlRG

## Protein viewer

When mouse-overing the lgv, dont show the 3codon view

Compactify header more

Thinner tracks

## links for coloy by strand, PUR

## Update docs: have live link for everything

## resize bars for groupby tracks not working well
