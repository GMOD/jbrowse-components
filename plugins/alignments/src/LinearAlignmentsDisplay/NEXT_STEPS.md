# WebGL Pileup Display - Next Steps

## Add Feature Interaction (Click/Hover)

Options: a) **Color picking** - Render feature IDs to offscreen buffer, read
pixel on click b) **CPU hit testing** - Store feature bounds, test mouse
position against them

## Vertical Scrollbar

Add a scrollbar component or integrate with existing JBrowse scrollbar.
Currently only shift+wheel scrolls vertically.

## Performance Considerations

- Current approach uploads all features in region to GPU
- For very high coverage (>50k reads), consider:
  - Downsampling at zoomed-out levels
  - Showing coverage instead of individual reads
  - Chunked uploading
- GPU memory usage: ~60 bytes per read (positions, y, flags, mapq, insertSize)
