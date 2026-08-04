---
id: core
title: core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

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
