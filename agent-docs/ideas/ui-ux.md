---
name: ui-ux
description: Loose UI threads: the CSS Custom Highlight API for search text, height-resize gestures, a canvas offscreen buffer, super-compact mode, side labels for genes, global scrollZoom, and init/loading feedback.
---

# UI / UX

**CSS Custom Highlight API for search text.** `HighlightText` in `FacetedSelector`
manually splits strings and wraps matches in `<mark>` tags. The
[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/Highlight)
highlights `Range` objects without touching the DOM (no extra elements, no re-render on
query change); jbrowse-desktop already uses it. Complication in the faceted selector:
virtual rows mount/unmount on scroll, so ranges must be re-registered in a scroll-aware
effect. Firefox ≥117, Chrome ≥105, Safari ≥17.2.

**Height resize.** Double-click resize handle, drag to resize, prevent shrinking,
auto-shrink toggle.

**Canvas offscreen buffer.** Margin rendering to avoid feature re-juggling on small
pans/zooms (like `plugins/sequence`).

**Super-compact mode** for very dense gene annotations (pack features even tighter).

**Side labels for genes.** Gene-name labels in the left/right margin instead of inline.

**Global scrollZoom.** Per-view → global setting.

**Init/loading feedback.** Distinguish initialized vs loading state in LinearGenomeView.

**Collapsed multi-transcript indicator.** When a gene track collapses to the longest
coding transcript per gene, users have no cue it happened. Options considered, ranked by
noise vs discoverability: (1) hover-tooltip-only ("4 transcripts · showing longest
coding") — invisible until hovered, good companion to anything else but too quiet alone;
(2) **recommended** — small stack/layers icon next to the track name in the header, shown
only when collapse is active, tooltip explains + optionally toggles "show all"; one icon
per track, not per gene, sits with existing track controls; (3) corner badge overlaid on
the render area — more discoverable, but floats over the data; (4) per-gene stacked-shadow
glyph — communicates without text but is the noisiest since it repeats per gene.
