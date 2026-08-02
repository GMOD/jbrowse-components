Data is only part of what a track draws. It also has states: fetching, failed,
region too large to load, GPU gave up. JBrowse draws those with five components,
and by default they are Material UI, which is the single biggest reason
embedding a track drags a UI toolkit into your app.

They are swappable. `DisplayChromeOverlayProvider` replaces the set for
everything below it, and JBrowse's own displays pick it up, so this is a change
you can make without forking a display or reimplementing a fetch lifecycle.

The third track below points at a URL that does not exist, so it holds still in
its error state. Toggle the checkbox to compare.

## Two seams, for two different problems

**Reach.** Every stock display imports `DisplayChrome` directly, so you cannot
redirect them at the import level. The provider is how you reach them. Material
UI still ends up in your bundle, because `DisplayChrome` references it, but
nothing on screen renders it.

**Weight.** If you are writing your own display component, import
`DisplayChromeBase` instead and pass `overlays` as a prop. It imports no toolkit
at all, so Material UI never enters the module graph. Measured on the eager
bundle: 302 KB with the stock chrome, 140 KB with plain overlays.

## What this does not remove

Swapping the overlays removes Material UI *components*. It does not remove the
*palette*. JBrowse's stock displays read theme tokens to colour their own
content: the feature display reads `palette.highlight.main` for highlight boxes,
the CDS renderer reads `palette.framesCDS` for reading frames. Those are
augmented entries a default MUI theme does not have, so a feature or alignments
track without `createJBrowseTheme` throws
`Cannot read properties of undefined (reading 'main')`.

So the boundary today is: the status UI is yours, the palette is still JBrowse's,
and you mount it with MUI's `ThemeProvider`. That is what `Palette.tsx` does in
the demo above. A wiggle track happens not to need it, which is why the first
three pages of this site have no such wrapper.

If you are writing your own display component this does not apply, because you
choose what your renderer reads.

## Writing a set

Implement `DisplayChromeOverlays`, five components with fixed prop shapes.
`plainChromeOverlays` used here is a dependency-free reference implementation
that styles itself from `currentColor`, so it inherits your cascade. Read it,
copy it, or write your own against the interface.

One constraint worth knowing: the six `data-testid` values in the plain set
(`loading-overlay`, `loading-overlay-cancel`, `loading-overlay-retry`,
`progress-chip`, `reload_button`, `use_canvas2d_button`) are a contract JBrowse's
own test suites key on. Keep them if you want those suites to run against your
set.
