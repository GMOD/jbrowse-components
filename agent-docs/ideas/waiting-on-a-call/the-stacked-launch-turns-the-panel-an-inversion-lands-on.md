---
name: the-stacked-launch-turns-the-panel-an-inversion-lands-on
description: The stacked breakpoint split view never reverses a panel, so an inversion opens as two forward windows that read against each other; turning each panel by the rule the single-row launch already has fixes the picture.
---

# The stacked launch turns the panel an inversion lands on

`navToSingleLevelBreak.ts` decides per end whether a panel is turned: the end
keeping the sequence to its right is reversed on the left, the end keeping its
left is reversed on the right (`panelIsTurned`), but only across two contigs.
`navToMultiLevelBreak.ts` builds the stacked panels, the shape every launch
defaults to and the only one the chain walk supports, and never sets
`reversed`. So no launch shape turns an intrachromosomal inversion.

Today an inversion breakend gives two forward panels of one chromosome, the
curve from the upper panel's right half landing in the lower panel's right
half, both feet pointing the same way, so the molecule reads right to left
through the lower panel. A foldback is the worst case: `eventStops` leaves ends
further apart than the window as two panels, so a 6 kb fold gives two windows
that read against each other.

- Building the stacked panels turns each by `panelIsTurned`, the first staying
  forward so the reader keeps one fixed frame.
- **Past two panels the turns compound**: a panel reached through two
  inversions reads forward again. Neither `ChainStop` (`walkBreakendChain.ts`)
  nor `PanelStop` (`navToMultiLevelBreak.ts`) carries an orientation, so the
  walk has to carry one before "turn the second panel" holds for a chain.
- `mirror` already reverses the copied track order on every odd panel; decide
  how it composes with a turned panel.
- The overlay needs nothing: `placeOnRow` reads the region's `reversed` flag
  and flips the feet with it, and `Variants.test.ts` pins that.

Not
[straighten-an-inversion-by-reversing-its-span](straighten-an-inversion-by-reversing-its-span.md),
which splits one synteny region in three; this flips one whole panel and leaves
the follow's fallback navigation alone.
[route-as-a-launch-input](../ready/route-as-a-launch-input.md) draws an
inverted segment as a reversed panel, so this is its first piece.

The call is the default; flip at launch is the recommendation, since the
picture is wrong without it. Undoing it is not one click: the panels open with
`hideHeader: true` and the split view's own menu has only "Reverse view order",
so the LGV's Horizontally flip needs the header turned on first.
