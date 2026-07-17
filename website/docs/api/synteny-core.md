---
id: synteny-core
title: synteny-core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## blendOverWhite

Composite a CSS color over white by `a`, returning an opaque `rgb(...)`. The
synteny canvas draws every ribbon at the view's global alpha over the white page
(shadeFill in syntenyTypes.slang / resolveInstanceFill in the Canvas2D
renderer), so a full-saturation legend swatch reads wrong — a red match ribbon
shows as salmon, a blue deletion as pale blue. Blending the legend chip the same
way keeps the key matched to what's actually on screen.

```js
// type signature
(color: string, a: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## coerceColorBy

Coerce a persisted colorBy string (stored as plain `types.string` for
snapshot-compat) to a valid `SyntenyColorBy`. Unknown values fall back to
'default'; the retired 'identityDiverging' mode maps to 'identity' so old saved
sessions keep rendering instead of hitting an unhandled switch case.

```js
// type signature
(value: string | undefined) => "default" | "strand" | "query" | "target" | "reference" | "identity" | "meanQueryIdentity" | "mappingQuality"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)
