- no click and drag lgv scroll when on bookmark icon
- make small samplot show at least 1px wide?
- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- aggressively refactor generate-screenshots
- group by strand plugins/canvas

## Coloring

Swap order in colo829


## links for color by strand, PUR


## treesidebar



1. Halo color is hardcoded to '#fff' — on a dark theme this would look like a stray white smudge instead of blending in. Should use theme.palette.background.default (or .paper) instead so it adapts to light/dark themes.
2. Hit area is still only 4px wide, same as before — visibility is better now but grabbing it precisely is still fiddly compared to the alignments/maf handles which use a wider band. Could widen to 6-8px without changing the visible line width.
3. Same hover-only invisibility pattern exists in MafCoverageResizeHandle.tsx and PileupComponent.tsx's resizeHandle/PileupResizeHandle — if those are also hard to spot over colored read/coverage bars, the same permanent-line treatment could be factored into the shared ResizeHandle (or a shared variant) rather than duplicated per call site.

## vendor electron-updater







## Fused abortsignal+stoptoken?

## Still need ultralong read cache?

