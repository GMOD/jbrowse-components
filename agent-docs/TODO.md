---
name: todo
description: The backlog — action items to build or fix, grouped by how ready each one is: small and self-contained, designed and ready to build, or blocked on a measurement that has to come first. Read when picking up work.
---

# Backlog

Grouped by **what you have to do first**, because that is the thing most of these
entries actually disagree on. 37 are ordinary build work, some of them carrying a
design that survived a rejected alternative and needs following rather than
re-deriving. 8 open with an instruction to go measure something, because the
premise or the cost attribution is not established and building first would be
guessing. Twelve are blocked on a visual call
that is not the implementer's to make.

**Each table is in the order to take it**, and a short paragraph above each says
what that order is by — so the top row is a real recommendation rather than
whichever entry was filed first. The ordering is editorial and nothing checks
it; move a row when the reason above the table stops describing it.

Exploratory concepts that are *not* committed work live in
[ideas/](ideas/README.md), one file per proposal.

**An entry earns its place by being worth doing, not by being written down.** A
triage on 2026-08-26 sent fourteen the other way: an entry whose own text says it
may close on a measurement rather than a build, and one whose horizon is a
session of its own that nobody has committed to, are both proposals. Each carries
a note at its top recording the move and why.

**One file per item, under [todo/](todo/).** Each carries the full entry as its
own doc, with `name:`/`description:` frontmatter and a `metadata.category`
matching which table below it is in. This table is the index; it does not
restate the entries, the way `ideas/README.md` does not restate its proposals.

**The index below is checked, not merely written.**
`website/scripts/check-todo-index.ts` (under `pnpm check-docs`) fails when a
file under `todo/` has no row, when a row points at a file that does not exist,
and when a row sits in a table its entry's own `category` disagrees with — it
cannot check the `Area` and `First move` columns, or the row ORDER, which are
editorial, but the half that rots is the half it covers.

## Ready to build: small and self-contained

Ordered. The first six are things a landed change is waiting on — a check owed
on code already in the tree, a prediction posed and never read, a window that
closes as the tree grows — and one of them may already be done. After that it is
ordinary build work, then the four that need a data build or a host before any
capture, then release validation.

| Item | Area | First move |
| --- | --- | --- |
| [The graph plugin's typecheck and unpushed commits](todo/the-graph-plugins-25-tsc-errors-and-three-unpushed-commits.md) | graph plugin, out of tree | the errors are fixed (`f1393b4`, 25 to 0) and all three `betabuild.sh` gates are green; what is left is the decision to publish, which is a live change to every config naming the bundle. Until it goes out, `pangenome_ecoli.md`'s last step is the only thing on that page a reader cannot perform |
| [Re-render the settings-menu figures](todo/re-render-the-five-figures-the-settings-menu-refactor-outran.md) | figures, synteny | probably already done — verify before spending the pipeline; three need a review, not a capture |
| [Verify the shared rect buffer headed](todo/verify-the-shared-rectcontinuation-buffer-on-real-hardware.md) | GPU canvas | code landed; only the headed WebGL2/WebGPU check is owed |
| [Brand the out-of-request refNames](todo/brand-the-out-of-request-refnames.md) | synteny, RPC | type-only; brand BOTH ends or the compare still passes. Take it while the comparisons still agree — that is what makes it type-only, and it stops being true as the tree grows |
| [Read the drift the AA ramp conversion predicts](todo/read-the-cross-backend-drift-the-aa-ramp-conversion-predicts.md) | shaders, GPU | all four converted; run the gate with the MSAA sample count held fixed, on a worktree with no second `runner.ts` in it |
| [Make the capture scroll-invariant](todo/make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu.md) | browser tests | it is `snapshot.ts`, not a shader — attribution is done. Widening the gate to webgpu is blocked on this alone |
| [Cover a per-base colour mode in the cross-backend gate](todo/cover-a-per-base-colour-mode-in-the-cross-backend-gate.md) | alignments, browser tests | one scene per mode in the existing gate; pick a zoom where `binBp > 1`. Same gate as the row above, and this is the hole that already let a false appearance claim ship |
| [Extra large text SVG mode](todo/extra-large-text-svg-mode-for-pub-ready-figures.md) | SVG export | thread a scale the way `fontFamily` threads |
| [A repeat's subpart labels collide in one row](todo/a-repeats-subpart-labels-collide-inside-the-row-they-now-share.md) | canvas | the row is reserved now; decide whether the one-row design survives |
| [Give colorNeutralRead a dark variant](todo/give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr.md) | alignments, palette | decide two neutrals or one before editing either |
| [An arc's right-click offers nothing](todo/give-an-arcs-right-click-something-to-offer.md) | alignments, arcs | decide the item set; the hit already resolves coordinates and support |
| [Let a dotplot click open the alignment it is on](todo/let-a-dotplot-click-open-the-alignment-it-is-on.md) | dotplot | the pick already answers; decide ship-ids vs resolve-on-demand first |
| [A config slot for `bezierRadiusRatio`](todo/decide-whether-bezierradiusratio-becomes-a-config-slot.md) | circular view, config | decide whether the state-model property stays beside the slot |
| [PanSN prefixes in the add-track form](todo/offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form.md) | comparative | the error half shipped; this is the discovery half |
| [A same-strand hidden junction is still solid](todo/a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid.md) | alignments | decide which renderer owns a marked junction; `isNormal` sends it to the straight pass |
| [Bound a breakend foot by its region](todo/bound-a-breakend-foot-by-its-displayed-region.md) | alignments | bound it by the REGION; the partner bound is wrong and was reverted |
| [Feet on the interchromosomal ticks](todo/give-the-interchromosomal-ticks-breakend-feet-too.md) | alignments | decide what a coalesced tick's direction is, then the shader |
| [One mark per interchromosomal cluster](todo/draw-one-mark-per-interchromosomal-cluster.md) | alignments | a figure-changing decision; pick the position rule first |
| [A fixed tick pool for the coordinate ruler](todo/give-the-coordinate-ruler-a-genuinely-fixed-tick-pool.md) | LGV, perf | the key half landed; what is left is the count delta |
| [Two spellings of "how tall is the embed"](todo/two-spellings-of-how-tall-is-the-embed.md) | embedded, API | the LGV ships `height`; decide whether the app's CSS variable becomes the same prop |
| [A validator gate for the examples sites' configs](todo/decide-whether-the-examples-sites-configs-get-a-validator-gate.md) | embedded, config | the file is fixed; what is open is the copy and where a gate lives |
| [Do the plugin `exports` surfaces earn a baseline](todo/do-the-session-and-plugin-exports-surfaces-earn-a-baseline.md) | plugins, ABI | recorded; build the plugin-`exports` baseline, and read the session one's blocker first |
| [Give `session.jbrowse` a real type](todo/give-sessionjbrowse-a-real-type.md) | core types, MST | pick one interface or two BEFORE touching any of the 36 sites |
| [Stop rewriting the worker's arrays](todo/stop-rewriting-the-workers-arrays-to-lay-out-features.md) | canvas | measured: skip the row offset, convert the two object arrays to SoA. The cheap half is the WIRE format alone — two files, 365ms to ~60ms at 60k — and is worth taking before the ~55-file version anyone commits to |
| [Say how many features are under the cursor](todo/say-how-many-features-are-under-the-cursor-in-a-collapsed-pileup.md) | canvas | the count is already in hand at hit time; a tooltip line is probably the whole job |
| [Turn the multi-sample variant tooltips off](todo/let-the-multi-sample-variant-display-turn-tooltips-off.md) | variants | a re-add — the rewrite dropped `showTooltips` and only the legacy-props comment remains |
| [A "hide this feature" item for multi-sample variants](todo/give-the-multi-sample-variant-display-a-hide-this-feature-item.md) | variants | copy `plugins/canvas`'s `hideFeature`; it moved to `featureSetViews.ts` |
| [Name the reference base in the coverage tooltip](todo/name-the-reference-base-in-the-coverage-tooltips-ref-row.md) | alignments | read `GetConsensusSequence` first — the seam for a non-render sequence fetch may already exist |
| [Group the canvas pileup by strand](todo/group-the-canvas-pileup-by-strand.md) | canvas, alignments | copy `GROUP_BY_DIMENSIONS`; `applyRowGroups` is a different axis |
| [Group reads by sample or library](todo/group-reads-by-sample-or-library-from-the-rg-header.md) | alignments | the adapter has to hand over an RG-to-SM/LB map; the grouping already exists |
| [A quantitative splice-junction track](todo/a-quantitative-splice-junction-track-of-its-own.md) | alignments, rnaseq | sashimi is an overlay only; the motif classification is already computed |
| [Rebuild the OrthoFinder demos' chrom.sizes](todo/rebuild-the-three-orthofinder-demos-chromsizes.md) | figures, synteny | rerun the script into `demos/`, then re-render three; raise alpha only uniformly, if at all. `demos/orthofinder_*` is still at `ffa68a2e84` and the two spec-side workarounds are still carrying it |
| [Shoot the multihop chain as counted arcs](todo/shoot-the-multihop-chain-as-counted-arcs-in-one-lgv.md) | figures, alignments | take the partner windows from the nanomonsv VCF, not the picture |
| [Capture the junction-BED tutorial figure](todo/capture-a-figure-for-the-junction-bed-tutorial-section.md) | figures, rnaseq | build and host the junction BED first; the capture is ordinary once it exists |
| [Produce and host the HPRC summary tier](todo/produce-and-host-the-hprc-summary-tier.md) | MAF, pangenome | built and hosted; report the overlap collapse upstream, then decide whether `showSummary` swaps on span or on cost |
| [Sample the seven remaining random release-validation units](todo/sample-the-seven-remaining-random-release-validation-units.md) | release validation, tests | read `git status` first — a worktree that ran a sweep is dirty until proven otherwise. Seven of the estimate's eight draws are outstanding, so this rises to the top of the file the moment a release is in view |
| [Write the one-page spec for two more concepts](todo/write-the-one-page-spec-for-two-more-cross-cutting-concepts.md) | release validation, architecture | name the two concepts before writing either; the plan never did |

## Blocked on a visual call

Twelve entries waiting on one person, which is the argument for taking them in
one sitting rather than one at a time. Ordered by how wrong the current picture
is: the first four draw something misleading today — a control nobody can read,
a bar eating its neighbour's space, two backends disagreeing by 41%, and ~600
hairlines nobody chose — and the rest are open questions about what a mark
should mean.

| Item | Area | First move |
| --- | --- | --- |
| [Midnight primary is invisible on dark stock](todo/midnight-primary-is-invisible-on-the-dark-stock-ground.md) | palette, theme | pick one of three; never re-tint a single component. 1.18 contrast on every primary element of the stock dark theme, and the set the two `styleOverrides` hatches miss grows with each component that leaves MUI |
| [The interbase stack overruns its half-band](todo/the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint.md) | alignments | a visual call; the overflow is measured, no fix is chosen — and it eats 50% of the coverage bars at exactly the locus someone navigates to |
| [Sub-pixel matrix rows draw 1px on the GPU and thinner on Canvas2D](todo/a-sub-pixel-matrix-row-draws-1px-on-the-gpu-and-thinner-on-canvas2d.md) | variants, backends | a visual call; the 41% is measured and neither side is obviously wrong |
| [Synteny clicked outline in tiled mode](todo/the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode.md) | synteny | get the visual call — hull silhouette or per-tile |
| [A mixed region set banners the whole display](todo/per-region-banner-for-a-mixed-region-set.md) | limits, chrome | decide whether a partially-refused display draws at all; the fetch is per-region and the banner is not |
| [Overlay labels cover the row below](todo/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md) | canvas | decide: reserve a row, or call overlay normal-mode only |
| [The read cloud's parked row is clipped by the band edge](todo/the-read-clouds-parked-row-is-clipped-by-the-band-edge.md) | alignments | a visual call; the clipping is measured and any inset has to reach the shaders |
| [Read cloud ticks every interchromosomal connection as a full-band vertical](todo/read-cloud-ticks-every-interchromosomal-connection-as-a-full-band-vertical.md) | alignments | a visual call; the parked row is a candidate home, but a square carries neither the partner name nor the support width. Take it with the row above — both are the same band and the same decision about what a parked mark looks like |
| [Should chromosome painting colour a same-chromosome mate](todo/should-chromosome-painting-colour-a-mate-on-the-same-chromosome.md) | alignments | a visual call; any gate has to spare LGVSyntenyDisplay's Query name, which must paint every block |
| [What colour is an arc with no pair orientation](todo/what-colour-is-an-arc-with-no-pair-orientation.md) | alignments | a visual call, then one of two edits |
| [Chain mode flags an unmapped mate, not an interchromosomal one](todo/chain-mode-flags-an-unmapped-mate-but-not-an-interchromosomal-one.md) | alignments | decide whether the asymmetry is deliberate; `colorUtils.test.ts` pins neither half |
| [The polyprotein strand arrow centres on the whole stack](todo/the-polyprotein-strand-arrow-sits-at-the-centre-of-the-whole-stack.md) | canvas, glyphs | a visual call; the transcript path one file over says one row, this one says all of them |

## Measure first: the premise or the cost attribution is unconfirmed

Ordered by what the measurement costs, cheapest first — the top of this table is
an afternoon's worth of numbers that between them close or unblock five entries.
Every entry here still has a number owed; two that no longer did moved to the
first table on 2026-08-26, since what was unconfirmed in them had become the
scope of the build rather than the premise.

| Item | Area | First move |
| --- | --- | --- |
| [Cross-region arc count at 300x](todo/read-the-cross-region-arc-count-at-300x-which-the-arc-cap-is-sized-from.md) | alignments, arcs | one `crossRegion.length` read; the cap's input is an estimate |
| [Watch the per-base refetch on a real BAM](todo/watch-the-per-base-refetch-on-a-real-bam.md) | alignments, RPC | count `RenderAlignmentData` calls over a scripted zoom; don't reason about the throttle |
| [Re-measure the bicolor split on the main thread](todo/re-measure-the-bicolor-split-on-the-main-thread.md) | wiggle, perf | ADR-016's premise is gone under ADR-078; take the number on a 1000-source multiwiggle |
| [Cut WebGL2 contexts per display](todo/cut-webgl2-contexts-per-display.md) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it. Read the analytics `software-rendering` bit first: it says how much of the no-WebGPU population is still in the group this would serve |
| [The swapped track resolves to a point](todo/the-swapped-assembly-track-resolves-to-a-point.md) | synteny | the hang is fixed; what is left is the swap, still not isolated — one more fixture separates orientation from column order |
| [The SV inspector rebuilds its chord track per filter](todo/the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter.md) | SV inspector | time it on a callset in the thousands, not the 44-row table |
| [Time a two-tier PIF to settled](todo/time-a-two-tier-pif-to-settled-in-a-browser.md) | synteny, PIF | bytes are measured; what is left wants the app and the ready gate |
| [Alignments main-thread repack](todo/alignments-still-repacks-every-row-instanced-pass-on-the-main-thread.md) | alignments, GPU | profile the pack/upload/clone split first |

