---
name: read-the-anchor-s-orientation-from-the-region-its-window
description: Read the anchor's orientation from the region its window sits on, so a `mixed` anchor can still drive the follow's auto-flip
area: comparative-and-pangenome
---

# Read the anchor's orientation from the region its window sits on, so a `mixed` anchor can still drive the follow's auto-flip

costed 2026-08-30
and declined. `orient` declines on `mixed` on either side, which loses the case
where a reader has reversed one region of the anchor by hand and is now looking
at another. The obvious fix — `displayedRegions.find` on the window's refName —
reintroduces the defect it would be fixing: a refName may appear in
`displayedRegions` more than once with different `reversed` flags, and
`followAnchorWindows` unions a refName's blocks into ONE window, so `find`
picks one of several answers arbitrarily — which is exactly how reading
`coarseDynamicBlocks[0].reversed` came to turn eight regions round to agree
with the one the window happened to be over. Declining is the honest answer for
a row that has no single orientation, and it matches what a mixed strand vote
already gets. Reopen with a window that carries its own region identity rather
than a refName.
