---
id: core
title: core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## buildColorRampLut

A 256-entry RGBA lookup table over sampleColorRamp, laid out as the 256x1
texture both GPU backends upload and the Canvas2D twins index — entry `i` is the
color at `t = i / 255`.

```js
// type signature
(stops: readonly ColorRampStop[]) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## relight

Move a color's OKLCH lightness by `lightnessShift` and scale its chroma, holding
its hue.

For extending a categorical palette past its length. Cycling a nine-color list
over a 24-chromosome karyotype repeats the color outright; cycling it with a
lightness shift per lap gives the hue back as a variant still told apart from
the original — tab20's construction, which pairs a light and a dark of each hue.

SHIFT rather than a fixed lightness, and SCALE rather than a fixed chroma,
because a categorical palette is uneven on purpose: category10's brown and its
red are 5 degrees apart in hue and are told apart by chroma alone, so
re-lighting both to one (lightness, chroma) makes them the same color. Keeping
each color's own relative chroma keeps brown reading as brown.

In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where the
same coefficient moves a yellow and a blue by visibly different amounts: a lap
has to read as one tone across the whole palette or it reads as noise.

```js
// type signature
(color: string, lightnessShift: number, chromaScale?: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/color/index.ts)

## sampleColorRamp

The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
interpolated per channel. `t` is clamped, so the ends are the end stops rather
than an extrapolation past them, and a one-stop ramp is that stop everywhere.

```js
// type signature
(stops: readonly ColorRampStop[], t: number) => ColorRampStop
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

A component rather than a documented pair of calls because the pair has a half
that can be left out with nothing to show for it. `PaletteProvider` is the name
a host reaches for, and it colors the React side alone; the session write is
what reaches the RPC worker, which bakes feature labels into the rendered image.
So a host that mounts only the provider gets light-mode labels on a dark page,
from a canvas whose every other pixel is right, and nothing errors. See
useSessionPalette for the mechanism.

The session is the only thing that resolves a palette here, so a host supplying
colors of its own mounts `PaletteProvider` directly instead.

```js
// type signature
({ session, mode, children, }: { session: ThemeModeSession; mode: "dark" | "light"; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/PaletteContext.tsx)
