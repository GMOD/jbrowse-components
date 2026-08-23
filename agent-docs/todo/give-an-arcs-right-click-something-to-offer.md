---
name: give-an-arcs-right-click-something-to-offer
description: decide the item set; the hit already resolves coordinates and support
metadata:
  area: alignments, arcs
  category: ready
---

# Give an arc's right-click something to offer

A right-click on an arc or a tick falls through to the browser's menu, because
`contextMenuTargetForHit` returns `undefined` for `type: 'arc'`. The fall-through
itself is the right rule — an empty menu is worse — so what is open is whether a
junction really has nothing, and it does not look that way: `ArcHitResult`
carries `x1`/`x2` in absolute genomic bp and the `support` count behind the
stroke width, and `ArcLineHitResult` carries `bp` plus `partnerRefNames`, which
is exactly the "where does this reach" a tick's own geometry cannot show. Center
on the mate, open the far side in a new view, copy the junction — all reachable
from what the hit already resolved.

Two things are in the way, and the second is the design question. `ArcMarkHit`
narrows the hover to `{tooltip, highlight}` and drops the `ArcBandHitResult`
behind them, so the coordinates do not survive to the menu builder — cheap to
fix. Then `ContextMenuHit` **requires** `block` and `genomicPos`, and its comment
says why: "a menu built without one was never a real state", which the split-state
sort bugs earned. An arc resolves an `ArcHitRegion`, not a `ResolvedBlock`, so
either arcs get a real block or that invariant needs a considered second shape.
Don't relax it casually.

Decide the item set first — it is a product call, not an implementation one.
