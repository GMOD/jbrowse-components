## Alignments / canvas

- Read cloud: show "read bars" on the reads themselves (currently just horizontal lines).
- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## MAF canvas "Loading" placeholder never clears with a 2nd track

`gallery/celegans_26way` (screenshot-review.json): a MAF display's
coverage/conservation canvas has a real gap where no alignment block covers the
region (genuinely empty, not a bug on its own) — normally paints blank. Add any
second track to the same view and that gap instead shows a permanently stuck
"Loading" placeholder. Reproduced 3/3, independent of track order, unaffected by
raising settleMs 90000->180000 in the screenshot generator (so it's not slow,
it's stuck) — the display's "-done" test-id fires quickly regardless, so
`waitForDisplaysDone` doesn't catch it. Likely: the empty-region draw path skips
clearing/overwriting the placeholder text when there's no data to draw. Not
investigated further.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.

## Synteny follow-ups

- `multiway_synteny/ecoli_pangenome` screenshot review is marked "bad" ("why
  are the synteny curves grey here?") — the default-color comment it was
  reacting to was stale (default is red, not grey; fixed in
  `SyntenyViewInit.ts`). Regenerate the screenshot and re-review to flip the
  status.
- `multiway_synteny/grape_peach_cacao` screenshot review is marked "bad":
  wants consistent coloring for the same block across levels (the shared
  middle genome should color-match between the peach–grape and grape–cacao
  ribbons). Separate design task, still open.



## more accurate cgiab

look at wakhan, pycnv

## more typescript improvements to cascadingmenu

## add extra large text svg mode for pub ready figures



## add dynamic nextstrain or more nextstrain demos



## deploy example-site to branch

# dotplot

in plugins/dotplot-view we have the idea of allocating space for refname labels. but in the hg19
  vs hg38 screenshot that we have in generate-screenshots the margins for refname labels on the axes
  are quite large maybe even oversized. can you check

## audit context menu code for e.g. alignments

## follow ups

- Push the shorthand one step further: refNameAliases/cytobands still require the full { adapter: { type: 'RefNameAliasAdapter', uri: '...' } } wrapper — a refNameAliases: { uri: '...' } shorthand (defaulting adapter.type) would trim that the same way, and it's the same preProcessSnapshot idiom already in place there.
- The riskier "auto-detect adapter type from extension" idea we discussed and deferred (fasta: 'foo.fa.gz' → infer BgzipFastaAdapter) is still on the table if you want maximal terseness, but I'd only do it if you're fine with implicit magic.
3

## occasionally mouseover on gene glyph does not show cursor pointer with mouseover shading



## add fit to height to jbrowse-img


## autofit height for lineargenomeview example-site demo

## human demo as main data in example-site demo3

## more aggressive scroll latch3

## debug hitbox

Done — the flag now defaults on. The example-site's dev server should hot-reload; move the mouse over a gene and you'll see:

- Red outlines = the actual hit-test rectangles (laidOutDataMap, padded exactly like the real flatbush box). Compare these against where the glyphs are painted.
- Blue outlines = drawn-glyph rectangles, drawn only during a Y-morph. If red and blue separate after a zoom, that's the bug in the act.
- Console [hitbox] logs on every mousemove — watch morphActive, hitFeatureId, unresolvedHit, resolvedHoveredFeatureId.

What to look for when a glyph doesn't light up:
- hitFeatureId: null + morphActive: true → confirms the morph draw/hit mismatch.
- hitFeatureId: null + morphActive: false on a static view → a coordinate offset (red boxes will look shifted from the glyphs); points me toward the DPR/trackWidthPx/border-offset path instead.
- unresolvedHit: true → hit found but the model getter failed to resolve it (a data/index desync).

To silence it without a rebuild: globalThis.__JBROWSE_HITBOX_DEBUG = false in the console.

Tell me what the red boxes and the log show and I'll pin the fix. (Reminder: this is default-on debug scaffolding — I'll flip it back off or remove it once we've nailed the cause.)

✻ Baked for 53s

❯ did you make bugfixes? i am not seeing issue anymore

No — I did not make any bugfix. Everything I added is purely additive debug instrumentation:

- two new files (hitTestDebug.ts, HitBoxDebugOverlay.tsx)
- a logging call appended after theleMouseMove (the setHover/clearHover code is byte-for-byte unchanged)
- a morphProgress field added to th
- the red/blue overlay rendered with pointerEvents: 'none' so it can't intercept anything

None of that touches the hit-test or hover code path. So the issue "disappearing" is meaningful
signal, not a fix. Two likely expla

1. It's intermittent and you're notr — consistent with the Y-morphhypothesis, which only manifests in the ~300ms after a zoom re-pack. On a statically-loaded view
there's no morph, so hover always w
2. The extra overlay/re-render subtly shifted render timing and is masking it. If adding a re-render
makes it vanish, that itself pointsbug (again, the morph).

Two quick checks to tell which:

- Do you actually see red outlines ms the new code is live (HMRsometimes doesn't pick up brand-new files — a full page reload forces it). If you don't see red
boxes, you're still on old code and
- Force the original trigger: zoom in or out a notch and immediately sweep the mouse across a gene
while it's animating into place. Waating from the blue drawn box, andcheck the console [hitbox] line for morphActive: true with hitFeatureId: null.

If you can reproduce it that way (or it stays gone even mid-zoom), tell me — that decides whether the fix is "hit-test against renders a coordinate bug.
                                                                                              Cogitated for 40s
                                                                                              i do see red outlines. the issue waation, it was persistently notmouseover shading even after morph settled
No, I made zero logic changes — the hover/hit-test code is untouched. So a persistent failurvanishes the moment I add an overla a big diagnostic clue: it means the bug is a MobX reactivity / stale-render problem, not a geometry or coordinate one. My debug added new observed reads (laidOutDagLabelsData) to the Overlaysobserver, and my log line reads model.hoveredFeature in the mousemove handler every move — ewhich can force a computed to re-evnder that wasn't happening before.That's masking the bug, not fixing it.
This fits the symptom: hoveredFeature (which gates both cursor and shading) is a computed → featureIdIndex → laidOutDataMap. Ifre-render, isn't invalidating whenit should, you'd get exactly this — persistently no shading even though the mouse is over the glyph, until something else triggers a ren
                                                                                                     Two quick things to confirm this anit:
                                                                                                     1. Toggle the instrumentation off wonsole:
globalThis.__JBROWSE_HITBOX_DEBUG = false                                                            1. then mouse over genes. If the buy extra re-renders were masking areactivity bug (and it's the overlay's observed reads doing it). Set it back to true to make it      disappear again.
2. Are the red boxes aligned with the genes? You said morph wasn't involved, so I expect yes — which rules out the coordinate/DPR path aause.
                                                                                                    Once you confirm #1 (bug returns wieal defect — most likely Overlaysnot tracking hoveredFeature, or the hoveredFeature/featureIdIndex/laidOutDataMap computed chain not invalidating — and fix that properl. Can you run the toggle test?

                          ## promotable preferences for plugins/canvas
                          show chevrons
                          etc3

## mouseover sequencefeaturepanel connect to linaergenomeview
