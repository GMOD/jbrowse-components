  1. Hover tooltip only (most invisible)

  Gene tooltip gains a line: "4 transcripts · showing longest coding". Zero persistent footprint —
  nothing on screen until you hover.
  - Pro: literally cannot add noise.
  - Con: completely undiscoverable; a user who never hovers never learns the view is collapsed. Too
  quiet on its own, but a good companion to anything below.

  2. Icon in the track label row (my recommendation)

  A single small icon (a stack/layers glyph) appears next to the track name in the header, only when
  collapse is active. Hover → tooltip "Showing longest transcript per gene — zoom in to see all".
  Optionally clickable to toggle "show all".
  - Pro: one icon per track, not per gene; sits where track controls already live, so it reads as a
  status, not data clutter. Doesn't draw over the genes at all.
  - Con: subtle enough to miss — though that's the point you asked for.

  3. Corner badge overlaid on the track render area

  Same idea as #2 but a small semi-transparent chip/icon pinned to a corner of the display (same
  family as existing LGV overlays). Slightly more present because it's over the data region.
  - Pro: more discoverable than a header icon, still one-per-track.
  - Con: floats over the genes, so marginally noisier.

  4. Subtle "stacked" glyph motif (per-gene, but not a label)

  Draw a faint offset shadow/second rectangle behind collapsed genes so they read as "more
  underneath," like stacked cards. No text.
  - Pro: communicates per-gene without any labels — technically satisfies your constraint.
  - Con: repeated across every collapsed gene, so it's the noisiest here despite having no words. I'd
  avoid it unless you specifically like the visual.

