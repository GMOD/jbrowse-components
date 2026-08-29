---
name: midnight-primary-is-invisible-on-the-dark-stock-ground
description: pick one of three; never re-tint a single component
metadata:
  area: palette, theme
  category: visual-call
  order: 1
  first_move: "pick one of three; never re-tint a single component. 1.18 contrast on every primary element of the stock dark theme, and the set the two `styleOverrides` hatches miss grows with each component that leaves MUI"
---

# Midnight primary is invisible on the dark-stock ground

`darkStock` changes only `mode` on top of `brandDefaults`, so `primary.main`
stays midnight `#0D233F`, and `getContrastRatio` puts that at **1.18** against
the `#121212` paper it is drawn on — against **15.9** on the light one. Every
primary-coloured element on a dark surface reads that one value.
`darkMinimal` overrides primary to `grey[700]` and does not have the problem
(3.04), so this is the stock dark theme alone.

**It is old and it is handled piecemeal**, which is the reason it needs deciding
rather than patching again. `theme.ts` carries two escape hatches already —
`darkModeContrastOverride` swaps a component's text to `text.primary`/`secondary`
in dark mode, and `darkModePrimaryIconOverride` does the same for the
`colorPrimary` icon slot — and both are MUI `styleOverrides`, so both reach MUI
components only. The docs site's link colour is a third, hand-written as forest
green at the point of use.

Found by comparing `StatusProgressBar` against the `LinearProgress` it replaced:
the two match exactly, dimness included, because both read `primary.main`. So
the bar is evidence, not the subject — **do not re-tint one component**, which
puts it out of step with everything beside it and hides the shared cause.

The visual call is which of three:

- **Give the dark presets a lighter primary**, the way `darkMinimal` already
  does. One edit in `palette.ts`, fixes every consumer at once, and changes
  JBrowse's dark branding — which is why it is a call and not a patch.
- **Add a resolved `primaryOnDark`** that `resolvePalette` fills from `mode`,
  and move the components that matter onto it. Keeps the brand colour where it
  is legible and names the intent, at the cost of a second slot every author has
  to know to reach for.
- **Keep patching per component.** Cheapest each time, and the reason the two
  overrides plus the link colour do not cover the toolkit-free components: a
  `styleOverrides` hatch cannot reach a `makeStyles` div at all, so the set of
  things it misses grows with every component that leaves MUI.

`ViewContainer.tsx` is the worked instance of that last sentence, and a fourth
patch site. Its focus ring reaches for `secondary.contrastText` because
`primary.main` on the header's grape band was "drawn, measured on screen, and
all but invisible" (`03982f1e70`) — a different ground from the `#121212` paper
above, the same midnight, and hand-written in a `makeStyles` block no
`styleOverrides` hatch could have reached.
