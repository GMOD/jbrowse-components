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
