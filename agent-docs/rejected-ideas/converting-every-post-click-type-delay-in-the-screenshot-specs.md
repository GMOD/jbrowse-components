---
name: converting-every-post-click-type-delay-in-the-screenshot-specs
description: Converting every post-click `{ type: 'delay' }` in the screenshot specs to that wait
area: tooling-tests-and-docs
---

# Converting every post-click `{ type: 'delay' }` in the screenshot specs to that wait

two of them are byte-identical swaps and the third proves the
class is not mechanical. `alignments_soft_clipped_menu` (2.5s sleep, 2.38s wait,
and the wait *saw* the toggle's refetch in 2 of 23 samples — i.e. the sleep had
~120ms of margin over real work) and `alignments/select_arc_display` (3s sleep,
1.0s wait) both reproduce their committed figure exactly. `search_feature_highlight`
does not: its sleep covers no app work, and capturing ~200ms earlier moved the
antialiasing of every glyph on the page, 0.68% of pixels, over the 0.5% diff
gate and invisible to the eye. A trailing sleep is therefore two different
things — app work, which the app can be asked about, and the page's own
rendering, which it cannot — and `website/scripts/probe-app-settled.ts` says
which one a given spec has before anyone edits it.
