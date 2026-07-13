---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Alignments / canvas

- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.


## more accurate cgiab

look at wakhan, pycnv


## add extra large text svg mode for pub ready figures



## autofit height for lineargenomeview example-site demo


## dotplot / circular SVG export freshness guard

Dotplot and circular-view SVG export have no export-after-pan freshness gate: a
pan/zoom immediately followed by Export SVG can capture the pre-move data during
the debounce+refetch window (dotplot's own code comment admits it). The LGV
families all close this: per-region displays via `viewportWithinLoadedData`,
HiC/LD via `viewportMatchesLastDrawn` (the `dataLoaded` freshness axis), arc via
`loadedRegionSignature`, synteny via `refetching`. Dotplot/circular need the
equivalent (a `svgReady`-style gate comparing loaded-data key to the current
view) before their `renderSvg` resolves.

## review release process


## sort by mismatch subitem of sort by menu

## unify checks in website and others

## check

The GPU shader computes both base edges (clip1, clip2) and applies flipX to the final clip coordinate, so reversed regions are handled correctly. But the Canvas2D drawMismatches draws a rect rightward from a single bpToScreenX(bp). Let me check the other per-base Canvas2D draws to see if they share this pattern.

  Searched for 4 patterns, read 3 files, listed 1 directory, ran 1 shell command

This reversed-block Canvas2D issue is real but niche. Let me now verify a higher-impact path: the no-MD-tag reference comparison offset, which if wrong would shift all mismatches. Let me check how ref and refOffset are supplied.

## slow virtual scroll
## max height


When we use 'grow to fit all reads' this can make incredible tall tracks that might blow up gpu memory usage, we probably need a cap to like screen height

I'll investigate how "grow to fit all reads" works and where track height gets computed, to find the right place to add a cap.

  Searched for 1 pattern, ran 2 shell commands

The feature is "Auto height — grow to fit all reads" in the alignments display, using fitHeightToDisplay and fittedHeightPx. Let me examine the model.

  Searched for 2 patterns, ran 1 shell command

There's already a GROW_MAX_HEIGHT cap. Let me find where it's defined and its current value.

  Searched for 2 patterns, read 1 file, ran 2 shell commands
Loaded plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md

There's already an 800px cap (GROW_MAX_HEIGHT). Let me understand why the user is still seeing incredibly tall tracks — perhaps the GPU canvas or a layout path bypasses the cap. Let me read the relevant model sections.

  Read 1 file
Loaded plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md

The 800px cap exists for the display height, but GPU memory depends on the canvas/texture size that's actually rendered. Let me check whether the GPU canvas is sized from the capped height or the full content height.

  Searched for 1 pattern, read 1 file

Let me check layoutGroupsToViewport to see how many rows actually get laid out in grow mode, and confirm the cap constrains layout not just display.

  Searched for 1 pattern, read 1 file

Now let me check the git history of this cap and whether it's actually committed/applied on this branch, plus how the GPU canvas gets sized.

  Ran 1 shell command

Both canvas and alignments already GHT = 800 (committed). So thedisplay/viewport height is bounded. The real GPU-memory question is whether the canvas backing store
or a scroll texture is sized from te check the PileupComponent canvassizing and how scroll is handled.

  Read 1 file

The canvas uses self.height (viewport, ≤800) and scroll is a windowed render, so GPU is bounded
there. Let me confirm nothing in thcapped contentHeight for a buffer,and check what autoHeight resolves to.

  Searched for 1 pattern

The canvas display's FeatureComponent sets a canvas height={model.contentHeight} at line 265 —
potentially uncapped. Let me examinht getter and that component.

  Read 1 file

The peptide canvas uses contentHeigfeature canvas element and checkwhether its height is capped, since that's the primary GPU allocation.

  Searched for 1 pattern, read 1 file

The main GPU canvas in the canvas display also uses model.height (capped) with virtual scroll. So the cap is already effective for GPht layout-stacking default and readthe passing cap test to be certain the 800 cap engages.

## unable to click normal when 'compact' pinned alignments
