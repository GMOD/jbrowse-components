---
name: byo-no-mui
description: State of the build-your-own product's "renders no Material UI" claim, the verified hole in the check that guards it, and the architectural decision waiting. Read before touching the display chrome/track-control seams or the BYO examples site.
---

# Build-your-own: the no-MUI claim

## Where it stands

`826689e7a7` added the second swappable seam. A stock wiggle, feature or
alignments display, unforked, now renders **zero elements carrying a `Mui*`
class** when an embedder installs both plain sets:

```tsx
<DisplayChromeOverlayProvider value={plainChromeOverlays}>
  <TrackControlProvider value={plainTrackControl}>{tracks}</TrackControlProvider>
</DisplayChromeOverlayProvider>
```

`MUI_BUDGET` in `products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs`
holds that per page, in both directions. See
[reference/DISPLAYCHROME.md](../reference/DISPLAYCHROME.md#the-bring-your-own-seams)
for how the two seams divide, and why they are two.

Read that sentence carefully, because the next section is about the gap between
it and what a reader of the site believes it says.

## The hole, measured

**`MUI_BUDGET` counts `Mui*` classnames. Components styled through
`makeStyles` don't have one.** `@jbrowse/core/util/tss-react`'s `makeStyles`
emits emotion classes (`css-5970li`) while reading the *Material UI theme*, so a
component can be fully MUI-dependent and completely invisible to the census.

`BaseTooltip` (`packages/core/src/ui/BaseTooltip.tsx`) is the live example.
Hover a feature on `/storybook/byo/your-own-feature-details/` and the DOM gets:

```
cls:  css-5970li
text: ctgA
bg:   rgba(97, 97, 97, 0.9)        <- alpha(theme.palette.grey[700], 0.9)
font: Roboto, Helvetica, Arial     <- MUI default typography
anyMuiClassOnPage: false           <- the census says zero
```

Both of those values come from **MUI's default theme**, because the host mounts
no `ThemeProvider` — so an embedder gets a grey Material tooltip in a font their
page never loaded, and the guard reports success. That is the worst failure
shape available: silent, and endorsed by a green check.

Fixing the tooltip alone is not the fix. The census is what's wrong.

## The root, and the decision waiting

`makeStyles` imports `useTheme` from `@mui/material/styles`
(`packages/core/src/util/tss-react/mui/mui.ts`). ~154 call sites use it, ~6 of
which take no `theme` argument. While that holds:

- the **weight** half of the pitch ("Material UI never enters the module graph")
  is unreachable for anyone rendering a stock display, no matter how many
  providers they install. The site says so plainly; that is honesty, not a
  solution.
- any new `makeStyles` component in a display's render path is a silent
  regression the guard cannot see.

The decision that keeps getting deferred: **a third provider, or one real UI
boundary?** Three contexts now stand between a display and a host's design
system (`PaletteProvider`, `DisplayChromeOverlayProvider`,
`TrackControlProvider`). Each was individually justified — this handoff's own
commit added the second — but "MUI leaked, add a context" has now happened
twice, and the tooltip is the third candidate. Adding it makes four. Before
doing that, decide whether the answer is instead a theme-free `makeStyles` (or a
`usePalette`-backed styling helper) that stock display components are *required*
to use, which would collapse all of it.

## What to do first

1. **Widen the census before adding anything.** Count what actually renders MUI
   *behaviour*, not MUI classnames — a fair proxy is any element whose computed
   `font-family` or colours came from the MUI default theme, or simply: assert
   no `@mui/*` module is evaluated in the page. Extend it over hover and
   menu-open states, not just at-rest. It will find `BaseTooltip`; assume it
   finds more.
2. Only then decide the tooltip's fate, with the full list in hand.

## Verifying, cheaply

The examples site is the harness. `pnpm build && pnpm smoke` in
`products/jbrowse-build-your-own/examples-site` runs six pages headless. For
anything the smoke check can't see, a throwaway puppeteer probe against the
built `dist/` is the pattern that found everything above — serve `dist/`, strip
the Astro base, `--use-gl=swiftshader`, settle ~7s, then measure. Write it as a
`.tmp.mjs` **inside the examples-site directory** (workspace module resolution
does not reach `/tmp`) and delete it after; `oxlint` will flag it if you forget.

Two traps that cost time here:

- `page.mouse.click` uses **viewport** coordinates. `scrollIntoView` the element
  and re-read its `boundingBox()` first, or every click lands on `<html>`.
- This is a **shared worktree**. Other agents' half-finished work will redden
  your runs — a wiggle TDZ regression failed three BYO pages during this
  session and cleared itself. Re-run before believing a failure is yours, and
  commit with explicit pathspecs.

## Don't

- **Don't raise `MUI_BUDGET` to make smoke pass.** It is the evidence for the
  site's central claim. A failure means a display started rendering something
  outside both providers; the number is the messenger.
- **Don't hide the corner controls** as a way to reach zero. The track-sizing
  button carries the count of features the layout dropped outright and the
  isoform notice is the only sign transcripts are hidden — a track that lies
  about its contents is worse than one with a stray Material widget. They needed
  a plain rendering, which they now have.
- **Don't factor the shared helpers out of the examples site.** See its
  `CLAUDE.md`: every page must be one complete copy-pasteable file, and the site
  was built the other way once and rewritten. That said, the duplication is
  now ~250 identical lines across six ~480-line files, and one pan-handler fix
  in this session had to land in five of them. If that becomes untenable the
  answer is a different *rule* (a full page plus delta-only successors), argued
  in that `CLAUDE.md` — not a quiet `src/browser/` module.
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
  exists precisely to be seen without hovering.
