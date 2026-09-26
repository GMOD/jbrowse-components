---
name: flip-the-inversion-panel-in-the-stacked-launch
description: The single-row breakpoint launch already turns a panel by which side its breakend keeps, so a fusion reads left to right; the stacked launch never sets a panel reversed, so an inversion's connectors cross in an X and a foldback's two same-chromosome panels read against each other. Apply the same kept-side rule when building the stacked panels, and give each panel a Flip entry in its submenu. The overlay already handles reversed regions, and the route launch input needs an inverted segment drawn this way.
---

# Flip the inversion panel in the stacked launch

`navToSingleLevelBreak.ts` decides, per end, whether a panel is turned. The
end keeping the sequence to its right is reversed on the left, the end keeping
its left is reversed on the right (`panelIsTurned`). `navToMultiLevelBreak.ts`
builds the stacked panels and never sets `reversed`, so the stacked shape,
which is the one every launch defaults to and the only one the chain walk
supports, draws every inversion-type junction as a crossing.

Today an inversion breakend gives two panels of the same chromosome, both
forward, the curve from the upper panel's right half landing
in the lower panel's right half, and the breakend feet pointing the same way.
The molecule reads right to left through the lower panel. A foldback is the
worst case, since `eventStops` leaves ends further apart than the window as
two panels, so a 6 kb fold gives two windows of one chromosome that read
against each other.

## The change

- Building the stacked panels applies `panelIsTurned` to the second panel of
  each junction, the way the single-row launch does. The first panel stays
  forward so the reader keeps one fixed frame.
- Each panel's submenu in the split view menu gains a Flip entry that calls
  the panel's own LGV flip action, for a reader who wants the other frame or a
  callset whose brackets are wrong.
- The overlay needs nothing: `placeOnRow` already reads the region's
  `reversed` flag and flips the breakend feet with it, and `Variants.test.ts`
  pins that.

## What it is not

[straighten-an-inversion-by-reversing-its-span](straighten-an-inversion-by-reversing-its-span.md)
is the synteny-view version, deferred on 2026-09-24, and it splits one region
in three to reverse the middle. This flips one whole panel, splits nothing,
lengthens no share link and leaves the follow's fallback navigation alone.

[route-as-a-launch-input](route-as-a-launch-input.md) draws an inverted
segment as a reversed panel, so this is the first piece of that work as well.

## What it waits on

A call on the default, flip at launch or menu entry only. Flipping at launch
is the recommendation, since the picture is wrong without it and the menu
entry restores the other frame in one click.
