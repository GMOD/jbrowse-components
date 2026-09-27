---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the coverage and ADR-181 figure reshoots, color.value recolouring normal arcs, synteny range on ramps, and a marker for bars clipped at the top of an axis"
---

## Open

- **Reshoot figures with a coverage band.** The 0.99 default changes any
  window with a spike; nothing was reshot.
- **Reshoot the ADR-181 figures**, where a point moved to the middle of its
  extent or a lane became a rule: `mark_display_examples/points`,
  `read_marks/insert_size`, `read_marks/chromosome` and
  `dog10k-size-fst-scan-igf1`. ada refused ssh at the landing.
- **`color.value` recolours normal arcs** under the normal scheme, since the
  arcs' neutral slot reads `colorPairLR`, which `value` sets for the reads.
- **Synteny `range` on ramps**: identity, mapq and numeric columns ignore it,
  where every other display's linear `range` sets the stops.
- **Web snapshots red on main, reasons known**: the LGV vector exports lost
  their outer `<g transform="translate(0 0)">` with the close-up removal
  (ddecae4f13); a canvas-feature line moved from y 19.5 to 18.5 (cause not
  traced); the synteny colour-by legend's viridis stops drift by one unit.
- **A marker for bars clipped at the top of an axis**, on wiggle and the
  coverage band, so a clipped bar does not read as its value. A visual call:
  show Colin a picture before building it across GPU, Canvas2D and SVG.
