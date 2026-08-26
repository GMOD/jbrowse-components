---
name: give-an-arcs-right-click-something-to-offer
description: an arc's right-click falls through to the browser's menu, and everything a menu would offer is already resolved at hit time — but nobody has decided the item set, and reaching a menu at all means giving `ContextMenuHit` a second shape, which the split-state sort bugs earned it against
---

# Give an arc's right-click something to offer

Moved out of [TODO.md](../TODO.md) on 2026-08-26. The fall-through is the right
rule today, so what is proposed is a product call nobody has made — and the
invariant in its way is one a class of bugs put there.

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
