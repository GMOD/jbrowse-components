---
name: a-zoom-fade-on-the-large-insertion-count
description: A zoom fade on the large-insertion count
area: rendering-and-displays
---

# A zoom fade on the large-insertion count

shipped, then removed
2026-08-16. It ramped
`labelFadeOpacity(length * pxPerBp, LONG_INSERTION_TEXT_THRESHOLD_PX)`, by
analogy with the deletion length label beside it. The analogy does not hold. A
deletion's fade compares the grey rect's width against the text that has to fit
inside it — two widths of the same rect — whereas **an insertion consumes no
reference bases**, so `length * pxPerBp` is a notional span the digits never
occupy, and the box they do occupy is `textWidth(length)`, by construction
exactly the room they need. So the room was never in question and the ramp
measured how big the insertion is while wearing legibility's clothes, which is
how it came to rest at 5% on a box with space to spare. It also **lagged the
box it was drawn in**: `insertion.slang` widens the marker from a 5 px bar to
22-40 px at 15 px of span, and the fade cleared the drop threshold at 17.03 px,
so a window of zoom drew a wide empty box — and nothing softened that pop,
since `insertionSizeAlpha` is `sizeAlpha`, which is 1 for any span above 1 px.
Both now key on the shader's own `isLarge`, pinned by "the count appears at
exactly the zoom its box widens at" in `computeVisibleLabels.test.ts`. **What
stays faded:** the deletion length, whose rect is the deletion's true span and
grows continuously — floored at `LABEL_FADE_FLOOR` so no still frame or SVG
export rests on illegible digits. **Reopen only for** a fade against something
an insertion actually has a width of.
