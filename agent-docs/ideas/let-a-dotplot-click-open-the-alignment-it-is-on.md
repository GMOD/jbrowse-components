---
name: let-a-dotplot-click-open-the-alignment-it-is-on
description: the dotplot resolves the alignment under the pointer and does nothing with the click, where synteny opens a widget off the same pick — and the better of the two ways to close it wants a new RPC method designed rather than a lane added to a fetch that would pay ~44ms per whole-genome pass to serve one click
---

# Let a dotplot click open the alignment it is on

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A feature, and the shape worth building needs a method
designed first.

The dotplot resolves the alignment under the pointer already — `pickFeatureAt`
answers a `{displayKey, featureIdx, segmentIdx}` hit, the tooltip names it, the
hover restrokes it — but a click does nothing with it. Synteny opens
`SyntenyFeatureWidget` from the same pick, so the asymmetry is the dotplot's, not
the widget's.

What is missing is only the payload: the widget wants a `uniqueId`, and the
dotplot fetch ships no `featureIds`. Two ways, and the cheap one is not obviously
right:

- **Ship them**, as synteny does. Measured cost of one `string[]` at 500k
  features is ~44ms of structured clone per fetch (`makeStringDict` in
  synteny-core carries the measurement), and a dictionary does not help because
  ids are distinct by definition. That is a real cost on every whole-genome fetch
  to serve at most one click.
- **Fetch the one id on demand**, from the hit's feature index, the way
  `SyntenyResolveMatchingRegion` returns an answer rather than a feature. Free on
  the fetch path, one round trip on the click, and it needs a new RPC method.

The second is the better shape and the reason this is not already done: it wants
the method designed rather than a lane added. Note the local coordinates the widget
takes are derivable without either — `dotplotTooltip.ts` already resolves both
axes' spans off the view's regions, and canonically, which is what that panel
should show.

Worth doing with it: the pointer handler currently clears a selection on any
click (`useDotplotInteraction`'s `onPointerUp`), so the new behaviour has to
distinguish "clicked an alignment" from "clicked empty plot to cancel", which the
hit already answers.
