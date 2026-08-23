---
name: embedded-title-bar-overhang
description: The embedded LGV's title bar is 28px while its buttons want 32, so they paint outside a bar nothing clips — 4px at the stock font, 23px at a 32px root. Now that the bar publishes its measured height, the 28 is purely a density choice; the three ways to close the overhang and what each costs.
---

# The embedded title bar overhangs its own box

`ViewTitle` (`packages/embedded-core/src/ui/ViewTitle.tsx`) is
`height: VIEW_HEADER_HEIGHT` — 28px. Its children want more, and always have:

| root font | bar | content wants | overhang |
| --- | --- | --- | --- |
| 16px (stock) | 28 | 32.00 | 4.00 |
| 20px | 28 | 35.70 | 7.70 |
| 24px | 28 | 40.84 | 12.84 |
| 32px | 28 | 51.14 | 23.14 |

Measured against the examples site at `setting-up-the-view`. Nothing clips it —
the bar is `overflow: visible` — so the buttons simply paint above and below,
over the LGV header beneath them, which they win against on z-index (900 vs
850). At the stock font that reads as a slightly tall-looking button row. At a
theme with a raised `typography.fontSize` it is plainly wrong.

Two contributors, and only one of them is rem-sensitive: the logomark
`IconButton` is a fixed 22px div plus 5px of padding, a flat 32 at every size;
the menu button's `MenuIcon` is rem-based, 30.56 at the stock font and past 51
by a 32px root.

## Why it is a choice now and was not before

Before, 28 was load-bearing: the LGV header stuck at `top: VIEW_HEADER_HEIGHT`
and `rubberbandTop` summed the same constant, so a title of any other height put
every sticky box below it off by the difference. `useChromeHeightVar` publishes
what the bar measures and those boxes read it, so the bar can now be any height
without moving anything out from under itself.

What stops it being a floor is density, not correctness. `minHeight` was tried
and reverted (`3122a92b87`): it grows every embed's title bar from 28 to 32 at
the stock font, which spends 4px of a box the *embedder* sized to stop a button
painting where nothing clips it. [vertical-real-estate](vertical-real-estate.md)
ranks that trade the other way round, and this is the one product where the host
picked the box.

## Three ways to close it

- **Shrink the content to the bar.** The honest fix, and the only one that costs
  no vertical space: an 18px logomark and a smaller menu icon put the natural
  height at or under 28, after which a `minHeight` yields exactly today's bar at
  the stock font and grows only when a theme genuinely demands it. It is a
  visual change to a published component's chrome, so it wants a human's eye,
  not a measurement.
- **Let it grow.** One line, and the accessibility story matches the web app's
  view header, which is a floor for exactly this reason. Costs 4px of every
  embed at the stock font.
- **Leave it.** Ten-year-old behavior, cosmetic, and invisible until a theme
  raises the font. This is where it stands.

The web app's own view header is not in this bucket: its content wants 27.14 at
the stock font, so making it a floor changed nothing at 16px and only stopped it
overflowing (by 2px at a 24px root, measured). That asymmetry is why one is a
floor and the other is fixed.
