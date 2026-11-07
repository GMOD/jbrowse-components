---
id: marks
title: "@jbrowse/plugin-marks"
description: "JBrowse 2 config-authored mark display: bars, points and spans drawn from a declared encoding over any feature track"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## staticMarkSvg

A mark display (`LinearMarkDisplay`) as its SVG export draws it, with no
session: the fetch the display issues over `frame`, the adapter's row
listing where the display draws rows, then the display's own views on a
static mark host, then its export body in the display shell. Returns the
body and the key the view places beside it. The refNames in `frame` must be
the adapter's, and the adapters registered on `pluginManager`.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, display, hiddenCategories, frame, id, opts, byteLimit, }: StaticMarkSvgArgs) => Promise<{ svg: Element; legend: StaticMarkLegend; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/staticSvg.tsx)
