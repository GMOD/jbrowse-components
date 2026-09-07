---
name: sharing-the-row-displays-hierarchy-getter-on-treesidebarmixin
description: Sharing the row displays' `hierarchy` getter on `TreeSidebarMixin`
area: config-and-mst
---

# Sharing the row displays' `hierarchy` getter on `TreeSidebarMixin`

—
re-priced 2026-08-18, after the toggles landed, and still declined. Four
displays (`LinearMafDisplay`, `MultiSampleVariantBaseModel`,
`LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`) each spell one
`computeClusterHierarchy(...)` call that differs only in which expression
supplies the content height, plus multi-wiggle's `isOverlay` short-circuit.

**The original objection dissolved and the answer did not change**, which is
what makes this worth writing down rather than re-deriving. That objection was
"three hooks it can't type"; the mixin now owns `root` / `treeAreaWidth` /
`showBranchLength` and `sources` is already its contract, so it really is down
to one hook.

That one hook is the problem. It is `rowsContentHeight`, and the comment
standing over that parameter in `clusterUtils.ts` exists to refuse exactly this
move: pass the viewport a display's rows scroll inside instead of the height
they add up to and the dendrogram still draws, still looks plausible, and names
the wrong rows. Today each call site spells the product out under that comment.
Behind a `treeContentHeight` hook the author implementing it sees the hook's
name and not the warning — so the refactor relocates the one parameter in that
package named to resist relocation, to save four lines.

The row-height ladder next to it is deliberately unshared too, and two of its
three differences look like drift and are not: canvas caps
`effectiveRowHeight` at `maxCanvasHeight / nrow` because it sizes its canvas to
its content; multi-wiggle has no `rowHeight` sentinel at all and branches on
`isOverlay`; and maf and canvas seed the `height` slot in `setFitToHeight`
where variants does not, because both of those *override* the `height` getter
to a content-derived value, so `self.height` in fixed mode is not the slot and
entering fit mode without re-seeding jumps. Variants leaves `height` to
`TrackHeightMixin`, where the same line would write the slot back to itself.
Check which `height` a display has before copying either. What IS shared is the
part with an actual rule — `resolveRowHeight`'s `0` sentinel plus non-positive
floor, the menu row and the dialog. See
[ROW_HEIGHT_AND_FIT.md](../reference/ROW_HEIGHT_AND_FIT.md).

**What this rejects is the computed ladder, not the config slots.** A
`rowHeightConfigSchemaFields` following the `treeSidebarConfigSchemaFields`
pattern is the shared half above and is endorsed, not blocked, by this entry —
it is in flight on the `row-height-mixin` worktree. The three differences named
here are the reason the *derived* values stay per-display.
