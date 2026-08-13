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
| [alignments](alignments.md) | Read-pair curved links, coverage decomposition by MAPQ / discordancy / HP, large-region viewing for dense BAM, SBX duplex `yc` coloring, and why CRAM decode parallelism is not the lever the profile points at. |
| [build-and-dependencies](build-and-dependencies.md) | The MUI v10 cleanup, lazy display behavior via `extendInstance`, and host-chosen plugin sets for embedded products. |
| [cancer-sv-datasets-unshot](cancer-sv-datasets-unshot.md) | Cancer SV datasets for figures, including the dead ends, recorded so nobody re-checks them. |
| [canvas-glyph-system](canvas-glyph-system.md) | The compact-mode subfeature-label overlap bug and why its fix belongs in main-thread packing, the per-glyph `{layout, emit}` registry rejected for four grounded reasons, and the per-gene isoform cap (top-N not first-N, main thread not worker). |
| [cgiab-tutorial-followups](cgiab-tutorial-followups.md) | C-GIAB tutorial follow-ups, each needing data prep and an S3 upload, so none of them is sandbox-runnable. |
| [config-and-sessions](config-and-sessions.md) | Relative-URI resolution, and why a single ambient base is the wrong answer to it. |
| [config-cleanups-declined](config-cleanups-declined.md) | Declined in the 2026-08 audit: the `fullConfSnapshot` throw and the config editor's slot enumeration. Read before re-proposing either. |
| [configuration-spec-layer](configuration-spec-layer.md) | ConfigurationLayer, adapter shorthands, and the declarative spec. |
| [data-formats](data-formats.md) | Partial-feature cues, circular genomes, and Zarr VCF. |
| [deferred-architecture-review](deferred-architecture-review.md) | The chrome loose end left after the bring-your-own-chrome pass, and the custom-display page that would answer "can I draw my own visualization", blocked on `render-core` being unpublished. |
| [display-height-redesign](display-height-redesign.md) | Three options for retiring the `heightOverride` name in `TrackHeightMixin`, and what each costs in snapshot migration. |
| [figure-work-parked](figure-work-parked.md) | Three figures the screenshot review left behind: the wheat Compara rebuild nobody has costed, a curated ortholog palette that means changing core `randomColor`, and a per-level dotplot scale that `squareView()` cannot express. |
| [hic](hic.md) | A user-draggable color threshold, checking normalization-vector availability before calling hic-straw, an A/B compartment log-ratio mode, and surfacing the inter-chromosomal data `getHeader` already detects but never shows. |
| [interaction-perf](interaction-perf.md) | Measured: the per-frame re-render culprit is the coordinate ruler, not the alignments overlays. Read before optimizing the wrong component. |
| [internet-accounts](internet-accounts.md) | The internet account model does six jobs across a boundary that only needs three, and Apollo3 is the downstream consumer that decides what can be broken and when. None of it is release-blocking; read before proposing the split or a sign-out menu. |
| [large-track-catalogs](large-track-catalogs.md) | Splitting discovery metadata from full config so a 100k-track catalog stays navigable. |
| [local-sequence-search](local-sequence-search.md) | Genome-wide exact sequence search versus running real BLAT locally, and what each would cost. |
| [methylation-plotting](methylation-plotting.md) | Modifications-track line and matrix views ranked by return: HP-stratified aggregate lines for allele-specific methylation, a simple aggregate line as the ~2h fallback, and a per-read matrix that `colorBy: modifications` + `sortBy: HP` may already cover. |
| [multi-hop-fusion-chaining](multi-hop-fusion-chaining.md) | SplitThreader-style multi-hop breakpoint chaining, and the one shared `Chain` type that would replace three triplicated copies of it. |
| [multi-sample-variant-display](multi-sample-variant-display.md) | Genotype-quality masking, pedigree awareness, `featureColor` presets, and haplotype-block coloring for the multi-sample variant displays. |
| [numeric-read-ids](numeric-read-ids.md) | readIds costs 33ms per query on the deepest short-read fixture — as much as the whole mismatch walk — building 153,677 template literals in the worker and structured-cloning them. Measured, scoped, and parked with the design and the one thing that makes it non-mechanical. Read before touching readIds or the alignments hit-test identity. |
| [offline-genome-packages](offline-genome-packages.md) | Relocatable genome packs plus a download manager for jbrowse-desktop: the existing hooks, the approaches, the size reality, and a recommendation. |
| [ortholog-navigation](ortholog-navigation.md) | A pangene-backed gene locator, the anchor-assembly model, and tiered MAF, for following one gene across genomes. |
| [pangenome-figures-unshot](pangenome-figures-unshot.md) | chrM as a whole-graph file, SMN1/SMN2, and carriage shown at the graph's own granularity. |
| [pangenome-viz-contribution](pangenome-viz-contribution.md) | Their guide describes a harder version of something that got easier once `@jbrowse/plugin-maf` landed in core. A draft exists; sending it is a decision about representing the project, not an implementation task. |
| [plugin-extension-points](plugin-extension-points.md) | Why the five widget/detail extension points are a bad abstraction, and the registry that would replace them. |
| [promotable-slot-ui](promotable-slot-ui.md) | How far a single promotable flag can drive generated UI in the config editor and the track menus. |
| [r-export](r-export.md) | One brain, N pens: the render IR behind an R export, and why it has to earn itself against SVG export first. |
| [search-misc](search-misc.md) | Two loose threads: a search advanced panel that may need a pagefind inverted index, and LDZip. |
| [session-spec-grammar](session-spec-grammar.md) | A Vega-Lite-style channel grammar for the session spec, in six parts: versioning the format, a uniform encoding block, reusable scales, collapsing three dialects to one canonical form, view combinators, and no sentinels in the public form. |
| [sv-search-language](sv-search-language.md) | The SV inspector import form matches query strings against spreadsheet columns, so it misses variants originating from a chromosome rather than naming it; a breakend/type/length/INFO language with AND/OR would not. |
| [synteny-comparative](synteny-comparative.md) | SV-type classification, `syntenyGroupId`, all-vs-all PAF, PIF limits, block-level chaining, the `featureId` instance ceiling, polyploidy-aware many-to-many synteny, and the 2026-07 vendor-format survey. |
| [tutorial-ideas-audit](tutorial-ideas-audit.md) | The 2026-07 tutorial audit: the GitHub demand tally, priorities, the two tutorials deliberately removed, the 2026-08 re-inventory of the 196 hosted tracks no page or spec names, and the genomes.jbrowse.org page audit. |
| [two-tutorials-left-open](two-tutorials-left-open.md) | The two tutorials the focus pass left open, including why `tutorials/rnaseq.md` needs a finding rather than a tour. |
| [ui-ux](ui-ux.md) | Loose UI threads: the CSS Custom Highlight API for search text, height-resize gestures, a canvas offscreen buffer, super-compact mode, side labels for genes, global scrollZoom, and init/loading feedback. |
| [vertical-real-estate](vertical-real-estate.md) | The "scrolls within scrolls" problem: a goodness hierarchy for the fixes, what the wheel/scroll machinery already does that you should not reinvent, a view-level height allocator, reclaiming non-data chrome, the publisher's own filter as a footprint lever, and an honest floor on what any of it buys. |
| [web-share-link-in-desktop](web-share-link-in-desktop.md) | Measured: the snapshot applies but drops `sessionTracks` in silence, so this is a translation problem and not a decode problem. |
| [website-copy-as-markdown](website-copy-as-markdown.md) | Per-page Markdown export and `llms.txt` for the docs site: the hybrid weighted toward GitHub raw URLs pinned to the build SHA, and the version-drift trade-off it accepts. |
| [website-screenshot-staleness](website-screenshot-staleness.md) | A spec edited without regenerating its PNG makes reviewers re-flag already-fixed figures — one batch went 8 specs, 0 PNGs. Hash the render inputs beside the committed PNG and fail CI when they drift. |
| [workspace-layout](workspace-layout.md) | Panel maximize and where its flag must not live, a tab overflow menu and what has to measure for it, and the drag gesture having no keyboard equivalent. |
<!-- END GENERATED IDEAS INDEX -->
