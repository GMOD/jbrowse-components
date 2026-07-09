## Alignments / canvas

- Read cloud: show "read bars" on the reads themselves (currently just horizontal lines).
- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

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


## add extra large text svg mode for pub ready figures



## autofit height for lineargenomeview example-site demo


## review release process

## generate-screenshots for dmel

## jest-fetch-mock

## easier sort by

potentially change large features first to a 'show...' submenu item

## Display height


I built jbrowse-web fresh (it compiles plugin-canvas from source, so it includes the committed changes), then wrote a throwaway puppeteer script against the existing browser-test harness: load gff3tabix_genes at ctgA:1..8000, drive the display's heightMode/height directly via window.JBrowseSession, log the resolved fitStage, and screenshot at each rung. Ran headless with swiftshader (software WebGL), so no GPU needed. Cleaned the script up afterward (it was never tracked).

What it confirmed

The resolved model state matched the render at every rung, and — critically — there were no label-on-box collisions at any level:

- full (h=520) — names + blue descriptions, fits exactly, no scroll.
- labels (h=420) — descriptions dropped, names kept and clean; the blue clutter from the baseline is gone. Fits, no scroll.
- bodies (h=110) — names hidden, all genes packed into a tight ~110px band, boxes still visible, zero collisions. This is the fix, versus the baseline's 7 overflowing rows of labels.
- floored (h=30) — squeeze clamped at fitMinScale=0.2, hasOverflow: true, 21px of scroll instead of shrinking boxes to nothing.

The min-box floor behaved exactly as designed: scale fell 0.71 → 0.43 → 0.24 as the track shrank, then held at 0.20 and started scrolling once fitting would push boxes below 2px.

So the two things my unit tests couldn't see — that the rendering actually reaches these states, and that the bodies level looks clean rather than collision-ridden — are now visually verified. This closes the gap I'd been flagging.

Offer

I didn't add a permanent browser test. The throwaway proved the point, but the same approach (drive heightMode/height, assert fitStage.level/fitScale/renderedShowLabels transitions — golden-image-free, so robust) would make a durable integration test that catches regressions the unit tests can't. Want me to add that as a committed suite?
