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
| [add-track-core](add-track-core.md) | One source of truth for adapter guessing, across the add-track paths that each carry their own. |
| [admin-tier-display-defaults](admin-tier-display-defaults.md) | An admin tier above the session default in the promotable-slot cascade, and the three frictions to read before starting. |
| [alignments](alignments.md) | Read-pair curved links, coverage decomposition by MAPQ / discordancy / HP, three coverage-band additions off data already shipped (strand-split allele bars, variant-to-variant navigation, a bedGraph export), large-region viewing for dense BAM, SBX duplex `yc` coloring, why CRAM decode parallelism is not the lever the profile points at, and why coalescing the per-lane depth buffers does not by itself lift `MAX_GROUPS`. |
| [arc-cluster-one-mark](arc-cluster-one-mark.md) | A windowed interchromosomal cluster draws one mark per supporting pair, each stamped with the whole cluster's weight — so the picture says N junctions where the data says one. What a single mark would cost, and why making the clustering zoom-dependent is the wrong shape for it. |
| [build-and-dependencies](build-and-dependencies.md) | The MUI v10 cleanup, lazy display behavior via `extendInstance`, host-chosen plugin sets for embedded products, and why an embedded component cannot switch itself to the RPC worker. |
| [cancer-sv-datasets-unshot](cancer-sv-datasets-unshot.md) | Cancer SV datasets for figures, including the dead ends, recorded so nobody re-checks them. |
| [canvas-glyph-system](canvas-glyph-system.md) | The compact-mode subfeature-label overlap bug and why its fix belongs in main-thread packing, the per-glyph `{layout, emit}` registry rejected for four grounded reasons, and the per-gene isoform cap (top-N not first-N, main thread not worker). |
| [cgiab-tutorial-followups](cgiab-tutorial-followups.md) | C-GIAB tutorial follow-ups, each needing data prep and an S3 upload, so none of them is sandbox-runnable. |
| [collapsed-mode-labels](collapsed-mode-labels.md) | Making `displayMode: 'collapsed'` keep its feature names, which is what would let a labelled lane take one row — the solver-not-a-row constraint, the stability-under-pan constraint, and the four consumers that have to agree on the answer. |
| [config-and-sessions](config-and-sessions.md) | Relative-URI resolution, and why a single ambient base is the wrong answer to it. |
| [configuration-spec-layer](configuration-spec-layer.md) | ConfigurationLayer, adapter-type inference from a file extension, and the declarative spec. The bare-`{ uri }` shorthand this used to propose has shipped. |
| [data-formats](data-formats.md) | Partial-feature cues, circular genomes, and Zarr VCF. |
| [deferred-architecture-review](deferred-architecture-review.md) | The chrome loose end left after the bring-your-own-chrome pass, and the custom-display page that would answer "can I draw my own visualization", blocked on `render-core` being unpublished. |
| [display-height-redesign](display-height-redesign.md) | Three options for retiring the `heightOverride` name in `TrackHeightMixin`, and what each costs in snapshot migration. |
| [figure-work-parked](figure-work-parked.md) | Three figures the screenshot review left behind: the wheat Compara rebuild nobody has costed, a curated ortholog palette that means changing core `randomColor`, and a per-level dotplot scale that `squareView()` cannot express. |
| [gpu-limits-in-bug-reports](gpu-limits-in-bug-reports.md) | A report from unseen GPU hardware names the adapter and omits every number that would explain the failure — the three limits are already being logged to a console nobody reads, so the change is to carry them on the capability object the stack-trace dialog copies. |
| [hic](hic.md) | A user-draggable color threshold, checking normalization-vector availability before calling hic-straw, an A/B compartment log-ratio mode, and a chromosome-pair selector for inter-chromosomal contacts — which nothing detects today, contrary to what this doc used to claim. |
| [hover-clear-on-track-reflow](hover-clear-on-track-reflow.md) | The fifth axis `installClearHoverOnViewportChange` doesn't watch — a track above changing height slides a display's box under a stationary cursor — why `view.trackHeights` is the tempting term and why wiring it in trades a self-healing staleness for a flicker. |
| [internet-accounts](internet-accounts.md) | The internet account model does six jobs across a boundary that only needs three, and Apollo3 is the downstream consumer that decides what can be broken and when. None of it is release-blocking; read before proposing the split or a sign-out menu. |
| [large-track-catalogs](large-track-catalogs.md) | Splitting discovery metadata from full config so a 100k-track catalog stays navigable. |
| [local-sequence-search](local-sequence-search.md) | Genome-wide exact sequence search versus running real BLAT locally, and what each would cost. |
| [maf-long-block-fetch-cost](maf-long-block-fetch-cost.md) | The MAF-tabix fetch cost on megabase alignment blocks — designed in full, parked because the premise cannot be confirmed in this repo. What the reporter would have to send before any of it is worth building. |
| [maf-subpixel-cells](maf-subpixel-cells.md) | MAF's GPU cell floor is measured in device px, so the display renders differently on a retina monitor than on a plain one and differently from its own Canvas2D fallback, which has no floor at all; three ways to settle it, why alignments' sizeAlpha is not one of them, and the capture that would decide. |
| [methylation-plotting](methylation-plotting.md) | Modifications-track line and matrix views ranked by return: HP-stratified aggregate lines for allele-specific methylation, a simple aggregate line as the ~2h fallback, and a per-read matrix that `colorBy: modifications` + `sortBy: HP` may already cover. |
| [multi-hop-fusion-chaining](multi-hop-fusion-chaining.md) | SplitThreader-style multi-hop breakpoint chaining, and the one shared `Chain` type that would replace three triplicated copies of it. |
| [multi-sample-variant-display](multi-sample-variant-display.md) | Genotype-quality masking, pedigree awareness, `featureColor` presets, and haplotype-block coloring for the multi-sample variant displays. |
| [offline-genome-packages](offline-genome-packages.md) | Relocatable genome packs plus a download manager for jbrowse-desktop: the existing hooks, the approaches, the size reality, and a recommendation. |
| [offscreen-synteny-mates](offscreen-synteny-mates.md) | Showing alignments whose mate lands on a contig the facing view is not displaying, as a stub/box rather than a ribbon. These are already fetched and are discarded one line into the worker's decorate loop — measured at 73% of peach chr1's anchors in the grape_peach_cacao demo — so the cheap half needs no fetch change at all. Read alongside two-axis-synteny-fetch.md, which is the expensive other half. |
| [ortholog-navigation](ortholog-navigation.md) | A pangene-backed gene locator, the anchor-assembly model, and tiered MAF, for following one gene across genomes. |
| [pangenome-figures-unshot](pangenome-figures-unshot.md) | chrM as a whole-graph file, SMN1/SMN2, and carriage shown at the graph's own granularity. |
| [pangenome-viz-contribution](pangenome-viz-contribution.md) | Their guide describes a harder version of something that got easier once `@jbrowse/plugin-maf` landed in core. A draft exists; sending it is a decision about representing the project, not an implementation task. |
| [plugin-extension-points](plugin-extension-points.md) | Why the five widget/detail extension points are a bad abstraction, and the registry that would replace them. |
| [promotable-slot-ui](promotable-slot-ui.md) | How far a single promotable flag can drive generated UI in the config editor and the track menus. |
| [r-export](r-export.md) | One brain, N pens: the render IR behind an R export, and why it has to earn itself against SVG export first. |
| [session-spec-grammar](session-spec-grammar.md) | A Vega-Lite-style channel grammar for the session spec, in six parts: versioning the format, a uniform encoding block, reusable scales, collapsing three dialects to one canonical form, view combinators, and no sentinels in the public form. |
| [sv-size-ring](sv-size-ring.md) | The SV inspector's circle can only encode a record's two endpoints, so a deletion and a duplication of any size both land on one point; a ring placing local events at a radius set by log10(span) would give the 80% of a callset that a chord cannot draw somewhere to be. |
| [synteny-comparative](synteny-comparative.md) | SV-type classification, `syntenyGroupId`, all-vs-all PAF, PIF limits, block-level chaining, the `featureId` instance ceiling, polyploidy-aware many-to-many synteny, and the 2026-07 vendor-format survey. |
| [tutorial-ideas-audit](tutorial-ideas-audit.md) | The 2026-07 tutorial audit: the GitHub demand tally, priorities, the two tutorials deliberately removed, the 2026-08 re-inventory of the 196 hosted tracks no page or spec names, and the genomes.jbrowse.org page audit. |
| [two-axis-synteny-fetch](two-axis-synteny-fetch.md) | Restoring the original both-rows synteny fetch joined on `syntenyId`, which the single-axis fetch replaced. Recovers alignments anchored on the target axis, which are never requested today. Blocked on a perspective-stable id for two adapters, PIF and all-vs-all — now verified rather than inferred. Read offscreen-synteny-mates.md FIRST: the larger, cheaper half of the same user-visible problem needs no fetch change and this doc used to be the only home for it. |
| [two-tutorials-left-open](two-tutorials-left-open.md) | The two tutorials the focus pass left open, including why `tutorials/rnaseq.md` needs a finding rather than a tour. |
| [ui-ux](ui-ux.md) | Loose UI threads: the CSS Custom Highlight API for search text, height-resize gestures, a canvas offscreen buffer, super-compact mode, side labels for genes, global scrollZoom, init/loading feedback, and a search advanced panel whose surface was never decided. |
| [vertical-real-estate](vertical-real-estate.md) | The "scrolls within scrolls" problem: a goodness hierarchy for the fixes, what the wheel/scroll machinery already does that you should not reinvent, a view-level height allocator, reclaiming non-data chrome, the publisher's own filter as a footprint lever, and an honest floor on what any of it buys. |
| [web-export-uncarried-state](web-export-uncarried-state.md) | Three things desktop's "export to web" can only report, not carry — a track delta it cannot tell from hub drift, an assembly edit, an internet account. Read before adding a carrier or a pristine-base snapshot. |
| [web-share-link-in-desktop](web-share-link-in-desktop.md) | Measured: the snapshot applies but drops `sessionTracks` in silence, so this is a translation problem and not a decode problem. |
| [website-screenshot-staleness](website-screenshot-staleness.md) | A spec edited without regenerating its PNG makes reviewers re-flag already-fixed figures — one batch went 8 specs, 0 PNGs. Hash the render inputs beside the committed PNG and fail CI when they drift. |
| [workspace-layout](workspace-layout.md) | Panel maximize and where its flag must not live, a tab overflow menu and what has to measure for it, and the drag gesture having no keyboard equivalent. |
<!-- END GENERATED IDEAS INDEX -->
