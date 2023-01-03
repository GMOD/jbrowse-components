---
id: creating_display
title: Creating a custom display type
---

Display types tell JBrowse how to "display" a given track in a particular view.
A track might "display" itself completely different depending on whether it is
in a dotplot or in a linear genome view. The "display" types may not actually do
the drawing of the track data: that is often done by the renderer. The display
will call the renderer though.

Here are some reasons you might want a custom display type:

- Drawing custom things over the rendered content (e.g. drawing the Y-scale bar
  in the wiggle track)
- Implementing custom track menu items (e.g. Show soft clipping in the
  alignments track)
- Adding custom widgets (e.g. custom `VariantFeatureWidget` in variant track)
- You want to bundle your renderer and adapter as a specific thing that is
  automatically initialized rather than the `BasicTrack` (which combines any
  adapter and renderer)
