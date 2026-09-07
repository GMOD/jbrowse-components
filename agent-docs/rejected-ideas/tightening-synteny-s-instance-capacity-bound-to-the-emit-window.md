---
name: tightening-synteny-s-instance-capacity-bound-to-the-emit-window
description: Tightening synteny's instance-capacity bound to the emit window
area: performance-and-measurement
---

# Tightening synteny's instance-capacity bound to the emit window

buys
nothing. It looks loose (`buildSyntenyGeometry`'s `cigarBudget` comes from
the full feature width), and since `segmentOffScreen` went per edge a window
bound would be sound, but every block wide enough for it to matter carries a
CIGAR and `clipLargeBlockToWindow` has already re-anchored it to the query
window, so `widthPx0 + widthPx1` is at most a window and a bit.
