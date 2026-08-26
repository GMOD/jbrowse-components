---
name: the-comparative-context-menu-sits-behind-no-bring-your-own-seam
description: `SyntenyContextMenu` reaches `@jbrowse/core/ui`'s `ContextMenu` and so `@mui/material` behind no seam, so an embedder who mounted `DisplayUIProvider` to keep Material off the page still gets it from a synteny or dotplot right-click. The fetch status shipped through the seam and needed no new contract; the tooltip was refused on the record. Read before designing a fourth context — and read why a rendered-element census reports 0 Material elements on a page with 105 eager Material imports.
---

# The comparative context menu sits behind no bring-your-own seam

Moved out of [TODO.md](../TODO.md) on 2026-08-26. The hole that was measured is
closed, what is left is latent, and the entry's own history is the argument for
parking it: the fetch status looked like it needed a contract until someone
compared the interfaces and found it needed none. Designing one for the context
menu before anybody has asked for it is the same mistake with a worse ratio.

**`ComparativeFetchStatus` is done and the tooltip was refused — the context menu
is the whole of what is left.** `SyntenyContextMenu`
(`LinearSyntenyDisplay/components/SyntenyContextMenu.tsx:1-3`) reaches
`@jbrowse/core/ui`'s `ContextMenu` directly, which is `CascadingMenu.tsx:11` and
so `@mui/material`, behind no seam at all — so an embedder who mounted
`DisplayUIProvider` to keep Material off the page still gets it from a synteny or
dotplot right-click.

**The tooltip is NOT open, and it is the one thing here not to redo.**
`ComparativeTooltip.tsx:1` goes through `@jbrowse/core/ui/BaseTooltip`, which
lost `@mui/material` in `2377b8b9c9` and is pinned there three times —
`muiFree.test.ts` in both `core` and `display-ui`, plus `BaseTooltip.test.tsx`.
A third seam for it was considered and rejected on the record:
[reference/DISPLAYCHROME.md](../reference/DISPLAYCHROME.md):955-963, "reach for the
palette before reaching for a fourth context".

The fetch status now goes through the seam, and the design question this entry
posed turned out not to be one. Its two states *are* `DisplayChromeOverlays`
entries — `Loading` and `BackgroundProgress` — and `ComparativeStatusModel`
already satisfies both of their model shapes structurally, both being
`{statusMessage?, statusProgress?}`. So it needed no new contract and no second
one: `synteny-core` depends on `@jbrowse/display-ui`, reads
`useChromeOverlayOverride()`, and falls back to a Material pair it binds itself
(a package cannot depend on `plugin-linear-genome-view`'s bindings).
`ComparativeFetchStatus.test.tsx` pins both directions.

**Check the shape before designing a contract for the one that is left.** The
context menu genuinely is its own shape, so it wants an entry of its own or a
second small contract in the same package — but the fetch status looked like that
too until someone compared the interfaces.

**One piece of this is fixed and the rest is latent, which is the trap.** The
loading bar was the only one that rendered without the user doing anything, and
`StatusProgressBar` is now toolkit-free, so the hole that was measured is closed
on the axis it was measured on: the BYO site's `synteny` page reports 0 Material
elements at rest **and** 0 during its first load. Everything else on that path is
Material and simply has not been reached yet — the context menu wants a
right-click, and `LoadingOverlay`'s cancel and retry are `IconButton`s that only
appear when a caller passes the handlers.

**The bundle is a separate question and the answer there is still no.** That same
page has 105 eager modules importing `@mui/material`, 42 of them first-party, and
ships 691 KB gzip; `ComparativeFetchStatus` reaches them through the
`@jbrowse/core/ui` barrel, which `menuItems.purity.test.ts` asserts reaches
Material as its negative control. A rendered-element census cannot see any of it
— see "0 Material elements and no Material UI are different claims" in
EAGER_BUNDLE.md, whose holder table is the real scope. So this entry buys an
embedder the look, not the bytes, and nothing here changes that on its own.

**Whoever gives the comparative displays a cancel and a retry passes exactly
those handlers**, which is the commit that puts a Material `IconButton` back on
the page — and it would land green, because nothing measures it. (That was its
own backlog entry once and no longer exists; this paragraph is what survived it.)

**The layering objection is gone.** This entry used to weigh three options
because `DisplayChromeOverlays` and its provider lived in
`plugins/linear-genome-view` while `synteny-core` depends on `@jbrowse/core`
alone, so the component could not read that context. The contract is
`@jbrowse/display-ui` now — a package, with no UI-toolkit dependency and no
plugin above it — so `synteny-core` depends on it like anything else, and the
prop types it names are the four structural model shapes that moved with it
rather than LGV display models.

**The loading-time census is wired in, so this list is no longer invisible.**
`recordMuiFromLoad` in the BYO site's `smoke.mjs` samples from before each page's
own scripts run and holds the union to `MUI_BUDGET`, which is how the progress
bar was found in the first place. It catches an element that *renders*, so it
covers the cancel and retry buttons the moment a caller passes those handlers.
The context menu is what it cannot reach: it needs a right-click nothing on that
page drives.
