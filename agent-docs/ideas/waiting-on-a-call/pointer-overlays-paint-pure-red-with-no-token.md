---
name: pointer-overlays-paint-pure-red-with-no-token
description: Six overlays that mark where the user is pointing or selecting draw a hand-written pure red; one palette token would give them one color and a dark value. Waits on whether that token is red or `accent`.
---

# Pointer overlays paint pure red with no token

Each of these marks the current position, hover or selection, and each spells
its own red:

- the current-region marker in the SVG header:
  `plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/SVGHeader.tsx`
  (`red` / `rgb(255,0,0)`);
- the same marker on the overview scalebar:
  `plugins/linear-genome-view/src/LinearGenomeView/components/OverviewScalebar.tsx`
  (`#f00` at 0.1);
- the coordinate label's guide line:
  `plugins/linear-genome-view/src/shared/coordLabels.tsx` (`red`);
- the dotplot's drag selection:
  `plugins/dotplot-view/src/DotplotView/components/MouseInteractionLayer.tsx`
  (`rgba(255,0,0,0.3)`);
- the LD crosshair: `plugins/variants/src/LDDisplay/components/Crosshairs.tsx`
  (`#e00`, with a `rgba(0,0,0,0.6)` casing that vanishes on dark);
- the hovered matrix connector: `plugins/variants/src/shared/ConnectorLines.tsx`
  (`#f00c`).

The core `Crosshairs` draws in `currentColor` and the page-ground rule says a
crosshair takes `accent` (`packages/core/src/ui/CLAUDE.md`), so these six are
also out of step with the rest of the pointer chrome.

## Proposal

One palette token, `pointer`, read by all six, with a dark value. The LD
crosshair's casing takes the ground color rather than black.

## What deciding it involves

- red or `accent`: red is what these sites converged on by hand and stands out
  over data in both themes; `accent` matches the core crosshair but is midnight
  in light mode, which disappears over dense blue data;
- captures of the overview marker, a dotplot selection and the LD crosshair,
  light and dark.
