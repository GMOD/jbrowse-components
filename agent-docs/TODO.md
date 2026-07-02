- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?







## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc




## xref dotplot

On the dotplot, if you're zoomed all the way out and then place your mouse near the edge of the plot and scroll to zoom in, the plot "jumps" so the cursor isn't on the same region anymore. At all other zoom levels, the area under the cursor stays smoothly under it when zooming, it's just from the max zoomed out level, and is much more noticeable when the cursor is near the edge of the plot.


## menu consolidates

- multi-wiggle trackMenuItems() (~93 lines) — same pattern, direct hic/maf precedent. Caveat: needs a couple of internal interfaces exported across packages (WithResolution), so slightly more plumbing.
- Small genuinely-pure transforms — alignments colorLegendCategories / buildCoverageBlocks, variant colorByAttributes. These are the cleanest demonstrations of the lever (plain args in, plain data out, zero self) but small (~15 lines each).

## many variants, turns into collapsed, looks like solid block, but is not. any way to convey this? should we not collapse by default maybe?

## sv

Now let's regenerate these two new screenshots and remove the stale chr5 link plus replace the KRAS/SMAD4 prose links with real Figures.

 Ran 2 shell commands

Both rendered. Let's review both before wiring into the doc.

 Read 2 files, ran 2 shell commands
You've hit your session limit · resets 12:10am (America/Los_Angeles)

✻ Baked for 1h 24m 10s

✻ Claude resuming /loop wakeup (Jul 1 10:57pm)

Good — this confirms the SMAD4 CN=1 LOH block (chr18:28,482,566-80,363,285) matches the figure and caption. That earlier scheduled check already resolved (I completed the investigation and am now implementing it). Continuing — let's wire the doc.

 Read 1 file
You've hit your session limit · resets 12:10am (America/Los_Angeles)
/usage-credits to request more usage from your admin.

## avoid showing percentages if it gets stalled or just instantly...should be loading for at least like 500ms or something

## zoom to variant in linear genome view should add grow 0.2

## ylayout labels

I am observing that in plugins/variants with a plain linearvariantdisplay (which uses plugins/canvas basic display) that the variants can get separated from their labels, see screenshot: [Image #1] please investigate. you can add debug logging or debug 'visualizations' if you want
[Image #1]

I'll investigate this. Let me look at the variants display and the canvas basic display code.

 Listed 2 directories, ran 1 shell command

The labels (hash IDs) at top are separated from the variant rects below. Let me examine the label positioning logic.

 Read 1 file

Labels are placed at featureBottomPx = topY + featureHeight. Let me see how variants produce topY/featureHeight and how the GPU rects get positioned — the mismatch suggests these diverge for variants.

 Searched for 1 pattern, read 2 files, ran 1 shell command

The main thread does layout (yMorph). Rects get repositioned but labels may use stale topY. Let me look.

 Read 1 file

Let me look at the LinearVariantDisplay model to see how it renders vs. the basic display.

 Read 2 files
Loaded plugins/variants/src/CLAUDE.md

Both rects and labels get the same layout offset. Let me check how the DOM overlay applies label Y (scrollTop etc).

 Read 1 file

Both labels and rects share the overlay coordinate space. Let me find where the worker builds topfeatureHeight, and label relativeY.
 Per-feature, box and label share th layout offset — so a constantvertical offset between all boxes and all labels points to the container/canvas positioning, not per-feature math. Let me look at th GPU canvas and the label overlay.
 The canvas is position: sticky and offset, while labels live in thescrolled content div. A constant offset between the two layers points at scrollTop/maxY/canvas-height. Let m
Loaded packages/core/CLAUDE.md
Let me look at how the GPU renderer applies scrollY and canvas height.
The per-feature layout is provably consistent (same layoutMap key & offset for rect and label). So the constant offset is a global scr the GPU canvas (paints with scrollY = model.scrollTop) and the label overlay (lives in the DOM-scrolled content div). Let me check what data the GPU upload uses and how scight changes.
 Read 1 file
 With S=0 and matching heights, the y consistent — yet the screenshotshows a ~200px constant gap. That means the box's rect-Y base and the label's topY base actually differ. Let me check pushBoxRect — on-zero vertical offset that thelabel's topY: 0 doesn't.
A constant vertical offset between boxes and labels can only come from the shader's single additive Y term: yTopPx = inst.y - u.scrollYabels means the GPU used a smaller scrollY than the DOM container actually scrolled. Let me check setScrollTop and its clamping.


## sort icons

import SwapVertIcon from '@mui/icons-material/SwapVert';

## dont do codeql so much ?
