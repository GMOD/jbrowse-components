---
name: todo
description: The backlog — action items to build or fix, grouped by how ready each one is: small and self-contained, designed and ready to build, or blocked on a measurement that has to come first. Read when picking up work.
---

# Backlog

Grouped by **what you have to do first**, because that is the thing most of these
entries actually disagree on. Roughly two fifths are ordinary build work; a
quarter carry a design that survived a rejected alternative and needs following
rather than re-deriving; most of the rest open with an instruction to go measure
something, because the premise or the cost attribution is not established and
building first would be guessing. Eleven are blocked on a visual call that is
not the implementer's to make.

Exploratory concepts that are *not* committed work live in
[ideas/](ideas/README.md), one file per proposal.

**One file per item, under [todo/](todo/).** Each carries the full entry as its
own doc, with `name:`/`description:` frontmatter and a `metadata.category`
matching which table below it is in. This table is the index; it does not
restate the entries, the way `ideas/README.md` does not restate its proposals.

**The index below is checked, not merely written.**
`website/scripts/check-todo-index.ts` (under `pnpm check-docs`) fails when a
file under `todo/` has no row, or a row points at a file that does not exist —
it cannot check the `Area` and `First move` columns, which are editorial, but
the half that rots is the half it covers.

## Ready to build: small and self-contained

| Item | Area | First move |
| --- | --- | --- |
| [A repeat's subpart labels collide in one row](todo/a-repeats-subpart-labels-collide-inside-the-row-they-now-share.md) | canvas | the row is reserved now; decide whether the one-row design survives |
| [Let a dotplot click open the alignment it is on](todo/let-a-dotplot-click-open-the-alignment-it-is-on.md) | dotplot | the pick already answers; decide ship-ids vs resolve-on-demand first |
| [A validator gate for the examples sites' configs](todo/decide-whether-the-examples-sites-configs-get-a-validator-gate.md) | embedded, config | the file is fixed; what is open is the copy and where a gate lives |
| [Two spellings of "how tall is the embed"](todo/two-spellings-of-how-tall-is-the-embed.md) | embedded, API | the LGV ships `height`; decide whether the app's CSS variable becomes the same prop |
| [An arc's right-click offers nothing](todo/give-an-arcs-right-click-something-to-offer.md) | alignments, arcs | decide the item set; the hit already resolves coordinates and support |
| [A tooltip outlives the menu that covered its display](todo/a-tooltip-outlives-the-menu-that-covered-its-display.md) | display-kit, maf | the display is never sent a mouseleave when a portaled menu takes the pointer; decide whether the chrome exposes its clear or the menu calls it |
| [A config slot for `bezierRadiusRatio`](todo/decide-whether-bezierradiusratio-becomes-a-config-slot.md) | circular view, config | decide whether the state-model property stays beside the slot |
| [A fixed tick pool for the coordinate ruler](todo/give-the-coordinate-ruler-a-genuinely-fixed-tick-pool.md) | LGV, perf | the key half landed; what is left is the count delta |
| [Read the drift the AA ramp conversion predicts](todo/read-the-cross-backend-drift-the-aa-ramp-conversion-predicts.md) | shaders, GPU | all four converted; run the gate with the MSAA sample count held fixed |
| [Extra large text SVG mode](todo/extra-large-text-svg-mode-for-pub-ready-figures.md) | SVG export | thread a scale the way `fontFamily` threads |
| [Alignments / canvas odds and ends](todo/alignments--canvas.md) | alignments, canvas | seven independent small items |
| [Group the methylation path's CIGAR walk](todo/group-the-methylation-paths-cigar-walk-the-way-the-marks-path-now-is.md) | alignments, perf | decide whether the exported callback's order is a contract |
| [A same-strand hidden junction is still solid](todo/a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid.md) | alignments | decide which renderer owns a marked junction; `isNormal` sends it to the straight pass |
| [Give colorNeutralRead a dark variant](todo/give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr.md) | alignments, palette | decide two neutrals or one before editing either |
| [Make the capture scroll-invariant](todo/make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu.md) | browser tests | it is `snapshot.ts`, not a shader — attribution is done |
| [Attribute the TIMEOUT mode](todo/attribute-the-60s-displaypainted-selector-wait.md) | browser tests | the census shipped; wrap the two selector waits that throw before it runs |
| [Shoot the multihop chain as counted arcs](todo/shoot-the-multihop-chain-as-counted-arcs-in-one-lgv.md) | figures, alignments | take the partner windows from the nanomonsv VCF, not the picture |
| [Re-render the settings-menu figures](todo/re-render-the-five-figures-the-settings-menu-refactor-outran.md) | figures, synteny | five stale; the lock cannot catch this class |
| [Rebuild the OrthoFinder demos' chrom.sizes](todo/rebuild-the-three-orthofinder-demos-chromsizes.md) | figures, synteny | rerun the script into `demos/`, then re-render three; raise alpha only uniformly, if at all |
| [A worker that loads but never says `ready`](todo/a-worker-that-loads-but-never-says-ready-hangs-its-boot-forever.md) | RPC | pull the timer half out of `withCallDeadline`; a boot has no token to compose with |
| [Brand the out-of-request refNames](todo/brand-the-out-of-request-refnames.md) | synteny, RPC | type-only; brand BOTH ends or the compare still passes |
| [Give `session.jbrowse` a real type](todo/give-sessionjbrowse-a-real-type.md) | core types, MST | pick one interface or two BEFORE touching any of the 36 sites |
| [Verify the shared rect buffer headed](todo/verify-the-shared-rectcontinuation-buffer-on-real-hardware.md) | GPU canvas | code landed; only the headed WebGL2/WebGPU check is owed |
| [The graph plugin's 25 tsc errors](todo/the-graph-plugins-25-tsc-errors-and-three-unpushed-commits.md) | graph plugin, out of tree | fix the two adapters' `config` type; one root cause is most of the 25 |
| [Feet on the interchromosomal ticks](todo/give-the-interchromosomal-ticks-breakend-feet-too.md) | alignments | decide what a coalesced tick's direction is, then the shader |
| [Bound a breakend foot by its region](todo/bound-a-breakend-foot-by-its-displayed-region.md) | alignments | bound it by the REGION; the partner bound is wrong and was reverted |
| [One mark per interchromosomal cluster](todo/draw-one-mark-per-interchromosomal-cluster.md) | alignments | a figure-changing decision; pick the position rule first |
| [Bound a cluster's diameter](todo/bound-an-interchromosomal-clusters-diameter.md) | alignments | measure at depth before changing what the floor means |
| [Re-measure the bicolor split on the main thread](todo/re-measure-the-bicolor-split-on-the-main-thread.md) | wiggle, perf | ADR-016's premise is gone under ADR-078; take the number on a 1000-source multiwiggle |
| [The read cloud's axis follows one outlier](todo/the-read-clouds-y-axis-autoscales-to-a-single-outlier.md) | alignments | needs a measurement on deep data, not a chosen statistic |
| [Linearize the pangenome](todo/linearize-the-pangenome-draw-graph-variation-as-alignment-style-glyphs.md) | pangenome | read PANGENOME_GRAPHS.md — four findings constrain the layout |
| [Pangenome graph view queue](todo/pangenome-graph-view-the-open-queue.md) | pangenome | three items unblock the rest; take the LGV axis first |
| [Collapse trivial bubbles in a file-loaded graph](todo/coarsen-a-graph-loaded-as-a-file-collapse-trivial-bubbles.md) | pangenome | designed; path lanes are the open question |
| [PanSN prefixes in the add-track form](todo/offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form.md) | comparative | the error half shipped; this is the discovery half |
| [The comparative context menu sits behind no seam](todo/the-comparative-context-menu-sits-behind-no-bring-your-own-seam.md) | synteny, dotplot, embedded | fetch status done, tooltip refused; the context menu needs a shape of its own |
| [The config-read baseline's remaining 129](todo/the-config-read-baselines-remaining-129-is-mostly-not-display-debt.md) | config, types | 75 of them are track/assembly reads; confirm that before estimating any of it |
| [Do the plugin `exports` surfaces earn a baseline](todo/do-the-session-and-plugin-exports-surfaces-earn-a-baseline.md) | plugins, ABI | recorded; build the plugin-`exports` baseline, and read the session one's blocker first |

## Blocked on a visual call

| Item | Area | First move |
| --- | --- | --- |
| [Should chromosome painting colour a same-chromosome mate](todo/should-chromosome-painting-colour-a-mate-on-the-same-chromosome.md) | alignments | a visual call; any gate has to spare LGVSyntenyDisplay's Query name, which must paint every block |
| [Chain mode flags an unmapped mate, not an interchromosomal one](todo/chain-mode-flags-an-unmapped-mate-but-not-an-interchromosomal-one.md) | alignments | decide whether the asymmetry is deliberate; `colorUtils.test.ts` pins neither half |
| [What colour is an arc with no pair orientation](todo/what-colour-is-an-arc-with-no-pair-orientation.md) | alignments | a visual call, then one of two edits |
| [Midnight primary is invisible on dark stock](todo/midnight-primary-is-invisible-on-the-dark-stock-ground.md) | palette, theme | pick one of three; never re-tint a single component |
| [The interbase stack overruns its half-band](todo/the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint.md) | alignments | a visual call; the overflow is measured, no fix is chosen |
| [Overlay labels cover the row below](todo/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md) | canvas | decide: reserve a row, or call overlay normal-mode only |
| [The polyprotein strand arrow centres on the whole stack](todo/the-polyprotein-strand-arrow-sits-at-the-centre-of-the-whole-stack.md) | canvas, glyphs | a visual call; the transcript path one file over says one row, this one says all of them |
| [Synteny clicked outline in tiled mode](todo/the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode.md) | synteny | get the visual call — hull silhouette or per-tile |
| [Sub-pixel matrix rows draw 1px on the GPU and thinner on Canvas2D](todo/a-sub-pixel-matrix-row-draws-1px-on-the-gpu-and-thinner-on-canvas2d.md) | variants, backends | a visual call; the 41% is measured and neither side is obviously wrong |
| [Fill the hi-C rectangle, not just the triangle](todo/fill-the-whole-display-rectangle-not-just-the-hi-c-triangle.md) | hic, GPU | decide what the y axis means once the apex stops bounding it; the cost is measured |
| [A mixed region set banners the whole display](todo/per-region-banner-for-a-mixed-region-set.md) | limits, chrome | decide whether a partially-refused display draws at all; the fetch is per-region and the banner is not |

## Measure first: the premise or the cost attribution is unconfirmed

| Item | Area | First move |
| --- | --- | --- |
| [The swapped track resolves to a point](todo/the-swapped-assembly-track-resolves-to-a-point.md) | synteny | the hang is fixed; what is left is the swap, still not isolated |
| [Observer reactions leak from discarded renders](todo/destroying-an-mst-tree-that-something-still-observes.md) | app-core, drawer | the boundary audit is done and came back clean; weigh preloading a child chunk against the bundle graph |
| [Cut WebGL2 contexts per display](todo/cut-webgl2-contexts-per-display.md) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it |
| [Split the arc band's uniforms off the pileup struct](todo/split-the-arc-bands-uniforms-off-the-pileup-struct.md) | alignments, GPU, limits | the 4 -> 2 MiB was arithmetic on a slot that is not arc-only; it is 4 -> 3, so measure the ring before spending the regen |
| [Produce and host the HPRC summary tier](todo/produce-and-host-the-hprc-summary-tier.md) | MAF, pangenome | built and hosted; report the overlap collapse upstream, then decide span vs cost |
| [Cross-region arc count at 300x](todo/read-the-cross-region-arc-count-at-300x-which-the-arc-cap-is-sized-from.md) | alignments, arcs | one `crossRegion.length` read; the cap's input is an estimate |
| [Does a quality floor still buy anything on the band](todo/does-a-base-quality-floor-still-buy-anything-on-the-coverage-band.md) | alignments | measure the sub-Q20 share that SURVIVES the frequency floor |
| [Walk the CIGAR once per MM tag](todo/walk-the-cigar-once-for-a-reads-whole-mm-tag-not-once-per-group.md) | alignments, perf | the same-base half shipped; what is left is worth ~1.1x and is Fiber-seq only |
| [Alignments main-thread repack](todo/alignments-still-repacks-every-row-instanced-pass-on-the-main-thread.md) | alignments, GPU | profile the pack/upload/clone split first |
| [Stop rewriting the worker's arrays](todo/stop-rewriting-the-workers-arrays-to-lay-out-features.md) | canvas | measured: skip the row offset, convert the two object arrays to SoA |
| [The SV inspector rebuilds its chord track per filter](todo/the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter.md) | SV inspector | time it on a callset in the thousands, not the 44-row table |
| [One inflate pool and byte cache per session](todo/give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them.md) | bgzf, RPC, limits | the speed premise is measured out; weigh the wasm memory, or close it |
| [Time a two-tier PIF to settled](todo/time-a-two-tier-pif-to-settled-in-a-browser.md) | synteny, PIF | bytes are measured; what is left wants the app and the ready gate |

