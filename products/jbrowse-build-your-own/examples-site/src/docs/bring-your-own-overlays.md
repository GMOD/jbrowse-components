Data is only part of what a track draws. It also has states — fetching, failed,
region too large to load, GPU gave up — and controls of its own, sitting in the
bottom-right corner. By default all of those are Material UI, and they are the
single biggest reason embedding a track drags a UI toolkit into your app.

They are swappable, and the demo below is JBrowse's own stock wiggle, feature
and alignments displays, unforked, rendering **no Material UI at all**. Toggle
the checkbox to compare. The third track points at a URL that does not exist, so
it holds still in its error state while you look.

Two providers do it, one for each half:

```tsx
<DisplayChromeOverlayProvider value={plainChromeOverlays}>
  <TrackControlProvider value={plainTrackControl}>
    {tracks}
  </TrackControlProvider>
</DisplayChromeOverlayProvider>
```

**`DisplayChromeOverlayProvider`** replaces the five components that draw the
status states. **`TrackControlProvider`** replaces the one component that draws
an ambient corner control — the track-sizing button every display with a
`heightMode` slot puts there, the isoform-collapse notice a feature track adds
next to it, the show-only badge.

Two rather than one because they are rendered by two different things: the
chrome around a display draws the first set, the display's own component draws
the second. Folding them together would put entries in `DisplayChromeOverlays`
that `DisplayChromeBase` never uses.

## Two seams, for two different problems

**Reach.** Every stock display imports `DisplayChrome` and `TrackControl`
directly, so you cannot redirect them at the import level. The providers are how
you reach them. Material UI still ends up in your bundle, because those two
modules reference it, but nothing on screen renders it.

**Weight.** If you are writing your own display component, import
`DisplayChromeBase` instead and pass `overlays` as a prop, and render a
`TrackControlComponent` of your own directly. Neither imports a toolkit, so
Material UI never enters the module graph. The measured saving is on the landing
page, and it is a real build rather than an estimate:
`pnpm measure-chrome-bundle` in the JBrowse repo bundles both entry points and
CI re-checks the result.

One thing to avoid in a display written that way: `makeStyles` from
`@jbrowse/core/util/tss-react` reads the Material UI theme, so importing it puts
Material UI straight back into your graph and undoes the saving. Style your own
display the way `plainChromeOverlays` and `plainTrackControl` style themselves —
inline, off `currentColor` and the CSS system colours — or with your own
stylesheet.

## What this does not remove

Swapping both sets removes Material UI _components_. It does not remove the
_palette_. JBrowse's stock displays read a palette to colour their own content:
the feature display reads `highlight` for highlight boxes, the CDS renderer
reads `framesCDS` for reading frames. Those are JBrowse's own entries, so a
feature or alignments track has to be told about them.

It is told through `PaletteProvider`, as the source below does, and what it
carries is a plain object of colour strings from `resolvePalette` rather than a
theme object. No Material UI is involved, and none is required. A wiggle track
happens not to need even that, which is why the first two pages of this site
supply no palette.

So the boundary today is: the status UI and the corner controls are yours, the
colours are still JBrowse's, and none of it costs you a UI toolkit.

If you are writing your own display component none of this applies, because you
choose what your renderer reads.

## Writing your own sets

`DisplayChromeOverlays` is five components with fixed prop shapes.
`TrackControlComponent` is one, taking a `TrackControlProps` that describes the
control rather than drawing it — an icon _name_ (never an element, or every
display would import an icon set again), a tooltip, an optional label, and
either a list of options or a click handler.

`plainChromeOverlays` and `plainTrackControl` are dependency-free reference
implementations that style themselves from `currentColor` and the CSS system
colours, so they inherit your cascade. Read them, copy them, or write your own
against the interfaces. Two details in `plainTrackControl` worth stealing rather
than rediscovering: its menu is portaled to `document.body` and positioned
`fixed`, because these controls sit on a display's bottom edge inside a
`contain: strict` box that would otherwise clip the menu; and it anchors the
menu's _bottom_ to the trigger's top, so it opens upward without anyone having
to measure its height.

One constraint worth knowing: the `data-testid` values in the plain sets
(`loading-overlay`, `loading-overlay-cancel`, `loading-overlay-retry`,
`progress-chip`, `reload_button`, `use_canvas2d_button`,
`track-control-dismiss`) are a contract JBrowse's own test suites key on. Keep
them if you want those suites to run against your set.

## This page is checked, not asserted

Everything above is a claim about what reaches the screen, so `pnpm smoke` in
this site counts the Material UI elements every page renders and fails if the
number moves — in either direction. It is zero here, and on every other page
that installs both sets.
