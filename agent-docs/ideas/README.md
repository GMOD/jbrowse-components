---
name: ideas-index
description: Index of every parked proposal in ideas/, with the hook each one is picked up by. Read when brainstorming product direction, or before re-proposing something that may already have been thought through here.
---

# Ideas index

Exploratory concepts and folded proposals — not committed work. Concrete action
items live in [TODO.md](../TODO.md); the split between them is commitment, not
size.

**Skim this table for your subsystem before proposing something.** A parked
proposal here often already contains the reasoning that kills the obvious
version of the idea, which is why re-proposing without reading it wastes a
session. A fair number were written precisely so the next session doesn't
re-derive them.

One file per proposal, so a heavy one can be taken off the shelf and worked
without reading its neighbours. The table below is generated from each doc's
`description:` frontmatter by `website/scripts/generate-doc-indexes.ts`, and
`pnpm autogen --check` fails on a doc that carries none. Don't edit between the
markers; write the doc's `description:` instead — that line is both the index
entry and what a reader sees when they grep the directory, so write it as the
hook someone picks the idea up by, not as a summary.

These were one file (`OTHER_IDEAS.md`) until 2026-08-13, and other docs and a
couple of source comments cite entries **by filename** now rather than by
section title. Renaming one is still a grep.

<!-- BEGIN GENERATED IDEAS INDEX -->

| Doc | What it covers |
| --- | --- |
| [absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md) | HiC and LD are the only two displays whose worker output is fetch-time pixel space, and that one decision is what keeps StaleViewportRescaleMixin, renderTransform.ts, a whole staleness axis and two hand-written reversal mirrors alive. What it would take to retire them, and the one binsize question to answer before starting. |
| [add-track-core](add-track-core.md) | One source of truth for adapter guessing, across the add-track paths that each carry their own. |
| [alignments](alignments.md) | Read-pair curved links, coverage decomposition by MAPQ / discordancy / HP, three coverage-band additions off data already shipped (strand-split allele bars, variant-to-variant navigation, a bedGraph export), large-region viewing for dense BAM, SBX duplex `yc` coloring, why CRAM decode parallelism is not the lever the profile points at, and why coalescing the per-lane depth buffers does not by itself lift `MAX_GROUPS`, and why the pileup's low-frequency threshold wants a read-count floor rather than a depth ramp. |
| [barrels-block-extraction](barrels-block-extraction.md) | A 169-line module with one runtime import pulls a 17,104-line closure because it imports through a barrel, and `render-core` sits in the same repo with 32 subpath exports and no `.` proving the alternative. The measurement, the two files that hold every leaf hostage, and why this is an extraction blocker rather than a bundle-size claim. |
| [build-and-dependencies](build-and-dependencies.md) | The MUI v10 cleanup, lazy display behavior via `extendInstance`, host-chosen plugin sets for embedded products, and why an embedded component cannot switch itself to the RPC worker. |
| [cancer-sv-datasets-unshot](cancer-sv-datasets-unshot.md) | Cancer SV datasets for figures, including the dead ends, recorded so nobody re-checks them. |
| [cgiab-tutorial-followups](cgiab-tutorial-followups.md) | C-GIAB tutorial follow-ups, each needing data prep and an S3 upload, so none of them is sandbox-runnable. |
| [circular-quantitative-ring](circular-quantitative-ring.md) | A wiggle drawn around the ring is the oldest unbuilt idea in the circular view, and the data half is already shipped — BigWigAdapter.getFeatureArraysMulti fetches every slice in one bbi pass at a zoom level chosen from bpPerPx. What is missing is a display, and the question that decides where it lives is which plugin owns QuantitativeTrack. |
| [collapsed-mode-labels](collapsed-mode-labels.md) | Making `displayMode: 'collapsed'` keep its feature names, which is what would let a labelled lane take one row — the solver-not-a-row constraint, the stability-under-pan constraint, and the four consumers that have to agree on the answer. |
| [config-and-sessions](config-and-sessions.md) | Relative-URI resolution, and why a single ambient base is the wrong answer to it. |
| [data-formats](data-formats.md) | Partial-feature cues, circular genomes, and Zarr VCF. |
| [deferred-architecture-review](deferred-architecture-review.md) | The chrome loose end left after the bring-your-own-chrome pass, and the custom-display page that would answer "can I draw my own visualization", blocked on `render-core` being unpublished. |
| [figure-work-parked](figure-work-parked.md) | Four figures parked on a cost or a decision: the wheat Compara rebuild nobody has costed, a curated ortholog palette that means changing core `randomColor`, a per-level dotplot scale that `squareView()` cannot express, and a 4-5 hour wolf-ancestry sweep across all autosomes. |
| [gpu-limits-in-bug-reports](gpu-limits-in-bug-reports.md) | A report from unseen GPU hardware names the adapter and omits every number that would explain the failure — the three limits are already being logged to a console nobody reads, so the change is to carry them on the capability object the stack-trace dialog copies. |
| [green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) | Four checks in this repo passed for structural reasons rather than real ones — a compiler standing in for the memo a sabotage deleted, a census that sampled only while the page was quiet, a drift check silent because all fourteen copies were wrong identically, and a branch every page rendered that no page could reach. The catch for each, and why the class is worth naming outside genomics. |
| [hic](hic.md) | A user-draggable color threshold, checking normalization-vector availability before calling hic-straw, an A/B compartment log-ratio mode, and a chromosome-pair selector for inter-chromosomal contacts — which nothing detects today, contrary to what this doc used to claim. |
| [internet-accounts](internet-accounts.md) | The internet account model does six jobs across a boundary that only needs three, and Apollo3 is the downstream consumer that decides what can be broken and when. None of it is release-blocking; read before proposing the split or a sign-out menu. |
| [jb2export-modifier-tables](jb2export-modifier-tables.md) | The jb2export track-modifier tables are the last big hand-maintained surface list in the docs, and the registry behind them already knows the names and the track types. What it does not know is the description, so generating them is a 32-entry tagging pass first. Read before adding a modifier, or before writing a checker for these tables. |
| [large-track-catalogs](large-track-catalogs.md) | Splitting discovery metadata from full config so a 100k-track catalog stays navigable. |
| [lightweight-toolkit](lightweight-toolkit.md) | Bring-your-own is a docs site, not a package, so there is nothing to install when someone wants the engine without the app. The four rungs an escape parachute actually has, the six silent failures a newcomer hits on the way to one track, the 81-member session interface that makes a small host impossible, and the two packages that are 404 on npm. |
| [local-sequence-search](local-sequence-search.md) | Genome-wide exact sequence search versus running real BLAT locally, and what each would cost. |
| [maf-subpixel-cells](maf-subpixel-cells.md) | MAF's GPU cell floor is measured in device px, so the display renders differently on a retina monitor than on a plain one and differently from its own Canvas2D fallback, which has no floor at all; three ways to settle it, why alignments' sizeAlpha is not one of them, and the capture that would decide. |
| [methylation-plotting](methylation-plotting.md) | Modifications-track line and matrix views ranked by return: HP-stratified aggregate lines for allele-specific methylation, a simple aggregate line as the ~2h fallback, and a per-read matrix that `colorBy: modifications` + `sortBy: HP` may already cover. |
| [mobx-state-patterns-to-publish](mobx-state-patterns-to-publish.md) | Two state-management patterns built and validated here that need nothing from genomics — splitting an autorun into a pure plan and an installer, and answering a lifecycle with one discriminated getter instead of N booleans every caller re-subtracts. Both have a failure story sharp enough to carry the idea, and neither has a name outside this repo. |
| [multi-hop-fusion-chaining](multi-hop-fusion-chaining.md) | SplitThreader-style multi-hop breakpoint chaining, and the one shared `Chain` type that would replace three triplicated copies of it. |
| [multi-sample-variant-display](multi-sample-variant-display.md) | Genotype-quality masking, pedigree awareness, `featureColor` presets, and haplotype-block coloring for the multi-sample variant displays. |
| [offline-genome-packages](offline-genome-packages.md) | Relocatable genome packs plus a download manager for jbrowse-desktop: the existing hooks, the approaches, the size reality, and a recommendation. |
| [offscreen-synteny-mates](offscreen-synteny-mates.md) | Showing alignments whose mate lands on a contig the facing view is not displaying, as a stub/box rather than a ribbon. These are already fetched and are discarded one line into the worker's decorate loop — measured at 73% of peach chr1's anchors in the grape_peach_cacao demo — so the cheap half needs no fetch change at all. Read alongside two-axis-synteny-fetch.md, which is the expensive other half. |
| [one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) | A feature is written three times — packGpu, drawCanvas, hitTest — across 3,335 lines in plugins/alignments alone, and nothing gates draw against hit test the way CI gates GPU against Canvas2D. arcs/mark.ts is the abstraction for exactly one feature; what generalizing it looks like, and the two things it must not do. |
| [one-upload-model-not-four](one-upload-model-not-four.md) | The HAL keys every buffer one way and four modules above it spell that key four ways, plus a fifth mechanism inside the HAL and eight displays hand-rolling the attach. ADR-017's premise expired in the direction its own "revisit if" named, and installPerRegionLifecycle.test.ts is a ready-made oracle for the collapse. |
| [ortholog-navigation](ortholog-navigation.md) | A pangene-backed gene locator, the anchor-assembly model, and tiered MAF, for following one gene across genomes. |
| [pangenome-figures-unshot](pangenome-figures-unshot.md) | chrM as a whole-graph file, SMN1/SMN2, and carriage shown at the graph's own granularity. |
| [plugin-extension-points](plugin-extension-points.md) | Why the five widget/detail extension points are a bad abstraction, and the registry that would replace them. |
| [plugin-main-process-bridge](plugin-main-process-bridge.md) | Four in-repo plugins and Apollo reach Electron's main process by hand-rolling `window.require('electron')` and restating channelTypes.ts with casts. The shape that fixes it is already in the tree as fileToLocation, the ReExports ABI objection to publishing more of them does not hold up, and one rule follows from why it does not. |
| [promotable-slot-ui](promotable-slot-ui.md) | Two follow-ons to the shipped promotable-slot cascade that interlock: an admin tier above the session default, and how far the single promotable flag can drive generated UI in the config editor and the track menus. Read both before starting either — the admin tier changes what the UI's checkbox means. |
| [r-export](r-export.md) | One brain, N pens: the render IR behind an R export, and why it has to earn itself against SVG export first. |
| [session-spec-grammar](session-spec-grammar.md) | A Vega-Lite-style channel grammar for the session spec, in six parts: versioning the format, a uniform encoding block, reusable scales, collapsing three dialects to one canonical form, view combinators, and no sentinels in the public form. Plus the two config-layer proposals that outlived the note this grew out of. |
| [sv-size-ring](sv-size-ring.md) | The SV inspector's circle can only encode a record's two endpoints, so a deletion and a duplication of any size both land on one point; a ring placing local events at a radius set by log10(span) would give the 80% of a callset that a chord cannot draw somewhere to be. |
| [synteny-comparative](synteny-comparative.md) | SV-type classification, `syntenyGroupId`, all-vs-all PAF, PIF limits, block-level chaining, the `featureId` instance ceiling, polyploidy-aware many-to-many synteny, and the 2026-07 vendor-format survey. |
| [tutorial-ideas-audit](tutorial-ideas-audit.md) | The 2026-07 tutorial audit: the GitHub demand tally, priorities, the two tutorials deliberately removed, the 2026-08 re-inventory of the 196 hosted tracks no page or spec names, and the genomes.jbrowse.org page audit. |
| [two-axis-synteny-fetch](two-axis-synteny-fetch.md) | Restoring the original both-rows synteny fetch joined on `syntenyId`, which the single-axis fetch replaced. Recovers alignments anchored on the target axis, which are never requested today. Blocked on a perspective-stable id for two adapters, PIF and all-vs-all — now verified rather than inferred. Read offscreen-synteny-mates.md FIRST: the larger, cheaper half of the same user-visible problem needs no fetch change and this doc used to be the only home for it. |
| [ui-ux](ui-ux.md) | Loose UI threads: height-resize gestures, a canvas offscreen buffer, super-compact mode, side labels for genes, global scrollZoom, and a search advanced panel whose surface was never decided. |
| [upstreamable-ideas](upstreamable-ideas.md) | The extraction work is aimed at other libraries copying the patterns, not at more people installing JBrowse — so an extraction is only finished when the idea has a name outside its JBrowse spelling. The inventory of what travels, split by whether it needs genomics, and why 45,264 lines of design writing currently reach nobody. |
| [vertical-real-estate](vertical-real-estate.md) | The "scrolls within scrolls" problem: a goodness hierarchy for the fixes, what the wheel/scroll machinery already does that you should not reinvent, a view-level height allocator, reclaiming non-data chrome, the publisher's own filter as a footprint lever, and an honest floor on what any of it buys. |
| [web-export-uncarried-state](web-export-uncarried-state.md) | Three things desktop's "export to web" can only report, not carry — a track delta it cannot tell from hub drift, an assembly edit, an internet account. Read before adding a carrier or a pristine-base snapshot. |
| [web-share-link-in-desktop](web-share-link-in-desktop.md) | Measured: the snapshot applies but drops `sessionTracks` in silence, so this is a translation problem and not a decode problem. |
| [website-screenshot-staleness](website-screenshot-staleness.md) | A spec edited without regenerating its PNG makes reviewers re-flag already-fixed figures — one batch went 8 specs, 0 PNGs. Hash the render inputs beside the committed PNG and fail CI when they drift. |
| [workspace-layout](workspace-layout.md) | Panel maximize and where its flag must not live, a tab overflow menu and what has to measure for it, and the drag gesture having no keyboard equivalent. |
<!-- END GENERATED IDEAS INDEX -->
