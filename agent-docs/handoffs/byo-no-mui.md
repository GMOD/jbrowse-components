---
name: byo-no-mui
description: State of the build-your-own product's "renders no Material UI" claim — what the census now measures, what it found and how that was fixed, and the weight half that is still out of reach. Read before touching the display chrome/track-control seams or the BYO examples site.
---

# Build-your-own: the no-MUI claim

## Where it stands

Two seams (`826689e7a7`) plus a palette-styled tooltip. A stock wiggle, feature
or alignments display, unforked, renders **nothing styled by Material UI** when
an embedder installs both plain sets:

```tsx
<DisplayChromeOverlayProvider value={plainChromeOverlays}>
  <TrackControlProvider value={plainTrackControl}>{tracks}</TrackControlProvider>
</DisplayChromeOverlayProvider>
```

See [reference/DISPLAYCHROME.md](../reference/DISPLAYCHROME.md#the-bring-your-own-seams)
for how the two seams divide, why they are two, and why the tooltip did not
become a third.

## What the census measures, and why it is two halves

`products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs`, per page, in
both directions:

1. **`MUI_BUDGET`** — outermost elements carrying a `Mui*` classname. Zero
   everywhere except `a-stack-of-tracks`, which shows stock chrome on purpose.
2. **`muiThemedStyling`** — elements whose computed `font-family` starts with
   `Roboto`, MUI's default typography, excluding anything already inside a
   `Mui*` subtree. Zero on every page, `a-stack-of-tracks` included. Run at rest
   **and** after a pointer sweep across each track.

Half 2 exists because half 1 has a hole that took a session to find, and it is
worth restating: **`makeStyles` components carry no `Mui*` class.**
`@jbrowse/core/util/tss-react`'s `makeStyles` emits an emotion class
(`css-5970li`) while reading the *Material UI theme*, so a component can be
fully MUI-styled and invisible to a classname count. `BaseTooltip` was exactly
that — a grey Material chip in a font the host page never loaded, on every page,
with the guard reporting zero. Silent, and endorsed by a green check.

The fingerprint is the font because it is the only one that discriminates: the
JBrowse palette *deliberately* reproduces MUI's color values
(`packages/core/src/ui/palette.ts`), so `rgb(97, 97, 97)` proves nothing, while
this site's own stack starts with `-apple-system` and nothing on it loads
Roboto.

Not covered: a themed `makeStyles` component that sets no typography. Three
exist in the display render path today (`BaseLinearDisplay`, canvas's
`FeatureComponent`, alignments') and all three are `makeStyles()({…})` with
**no theme argument** — layout only, no MUI value on screen. A new one that
takes `theme =>` and touches only colors would slip through both halves. If that
becomes a real risk the answer is to stop importing MUI's `useTheme` in
`makeStyles`, not a third census.

## What was fixed

`BaseTooltip` (`packages/core/src/ui/BaseTooltip.tsx`) now styles itself from
`usePalette()` plus inline styles, and inherits its font. **No provider was
added** — it needed colors, and colors already had a toolkit-free home. That is
the precedent for the next candidate: reach for the palette before reaching for
a fourth context.

It still imports MUI for `Portal` and for one theme read, the
`MuiPopper.defaultProps.container` a shadow-DOM embed configures (see the LGV
site's `ShadowDOMOneLinearGenomeView`). Neither contributes styling; both are
behaviour every other portaled thing in JBrowse shares.

**The guard was A/B'd, not assumed.** Reverting `BaseTooltip.tsx` to its
`makeStyles` version and re-running `pnpm build && pnpm smoke` fails 4 of the 7
pages with `<div class="css-5970li">` named in the output. So the census is not
vacuous — but three pages still passed, because whether a hover lands on a
feature in a headless swiftshader render is luck. `BaseTooltip.test.tsx` in
`@jbrowse/core` is the deterministic half, and the half to extend first if the
tooltip's look changes again.

## Still open: the weight half

`makeStyles` imports `useTheme` from `@mui/material/styles`
(`packages/core/src/util/tss-react/mui/mui.ts`), ~154 call sites. While that
holds, "Material UI never enters the module graph" is unreachable for anyone
rendering a stock display, no matter how many providers they install. The site
says so plainly, under "What you do not get rid of"; that is honesty, not a
solution. The fix, if it is ever worth it, is a theme-free `makeStyles` (or a
`usePalette`-backed styling helper) that stock display components are *required*
to use — which would also close the census gap above. `pnpm measure-chrome-bundle`
measures what the reach half costs today.

**The examples site cannot demonstrate this half, and it was assessed rather
than assumed.** `DisplayChromeBase` takes `model: ChromeModel &
RenderLifecycleModel<B>` plus a backend `factory` — so a page showing it needs a
display *model*, which means a config schema, a display type and a plugin to
register them, on top of the ~300 lines of view boilerplate every page here
repeats. Most of the resulting file would be about how to write a display, not
about the seam, and the site's "one page adds one thing" arc has nowhere to put
it. So the weight half stays prose (`src/docs/bring-your-own-overlays.md`, "Two
seams") with `plainChromeOverlays.test.tsx` as its only executable check. If it
ever gets a demo, it belongs outside the arc, and the honest scope is a
custom-display page that happens to use `DisplayChromeBase` — not a
`DisplayChromeBase` page.

## Verifying, cheaply

The examples site is the harness. `pnpm build && pnpm smoke` in
`products/jbrowse-build-your-own/examples-site` runs every page headless. One of
them (`run-it-in-a-worker`) is the site's only worker embed, and it is the
`workerSlug` the smoke check asserts a worker actually spawns on — A/B'd by
pointing `workerSlug` at `one-track`, which fails with `workers: []`. For
anything the smoke check can't see, a throwaway puppeteer probe against the
built `dist/` is the pattern that found everything above — serve `dist/`, strip
the Astro base, `--use-gl=swiftshader`, settle ~7s, then measure. Write it as a
`.tmp.mjs` **inside the examples-site directory** (workspace module resolution
does not reach `/tmp`) and delete it after; `oxlint` will flag it if you forget.

Two traps that cost time here:

- `page.mouse.click` uses **viewport** coordinates. `scrollIntoView` the element
  and re-read its `boundingBox()` first, or every click lands on `<html>`.
- This is a **shared worktree**. Other agents' half-finished work will redden
  your runs — a wiggle TDZ regression failed three BYO pages during one session
  and cleared itself. Re-run before believing a failure is yours, and commit
  with explicit pathspecs.

## Don't

- **Don't raise `MUI_BUDGET`, or narrow the font census, to make smoke pass.**
  They are the evidence for the site's central claim. A failure means a display
  started rendering something outside both providers; the number is the
  messenger.
- **Don't hide the corner controls** as a way to reach zero. The track-sizing
  button carries the count of features the layout dropped outright and the
  isoform notice is the only sign transcripts are hidden — a track that lies
  about its contents is worse than one with a stray Material widget. They needed
  a plain rendering, which they now have.
- **Don't factor the shared helpers out of the examples site.** See its
  `CLAUDE.md`: every page must be one complete copy-pasteable file, and the site
  was built the other way once and rewritten. The duplication is real — ~1950 of
  ~3500 example lines are verbatim repeats, and one pan-handler fix in one
  session had to land in five files — so the rule now has a guard rather than
  only a warning: `scripts/check-duplication.mjs` (run by `pnpm check-links`)
  fails when two same-named top-level blocks differ once comments are stripped,
  with a short `DIVERGES` allowlist for the per-page ones. A/B'd by perturbing
  `DRAG_THRESHOLD_PX` and a `horizontalScroll` call in one file; both were named
  with the odd file out and the exact line. If the allowlist starts growing, that
  is the signal the shared surface has outgrown copy-paste, and the answer is
  still a different *rule* argued in that `CLAUDE.md` — not a `src/browser/`
  module.
- **Don't add a corner control by importing MUI directly.** Describe it as
  `TrackControlProps` and render `TrackControl`; the icon is a *name*, never an
  element, or the display re-imports an icon package.

## Smaller loose ends

- Alignments' bottom-right row doesn't reserve its `VerticalScrollbar`'s 12px
  (canvas reserves 14 for its own). Cosmetic overlap with the thumb only —
  geometry was deliberately left unchanged to avoid churning PNG goldens that
  weren't verifiable in-session.
- `plainTrackControl` has one literal colour (`#d97706`, the warning tone).
  There is no CSS system colour for "something is wrong", and the warning state
  exists precisely to be seen without hovering. The location box on
  `drive-it-from-your-app` reuses that literal for the same reason.
