---
id: linear-genome-view
title: "@jbrowse/plugin-linear-genome-view"
description: "JBrowse 2 linear genome view"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## staticLgvSvg

A linear genome view's SVG export with no session: the chrome the view's
`renderToSvg` draws, over `view` (a `staticLgvFrame`) and the tracks a
static export drew in it, in order. Each body is drawn with
lgvSvgLayoutOptions' `fontSize`, as the view hands its displays.

```js
// type signature
({ view, tracks, theme, opts, }: { view: LgvSvgChromeView; tracks: StaticLgvTrack[]; theme?: ThemeOptions | undefined; opts: ExportSvgOptions; }) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/lgvSvgDocument.tsx)
