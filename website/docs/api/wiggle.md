---
id: wiggle
title: wiggle
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## wiggleTables

A region, or several, of a quantitative track as the wiggle display fetches, scales and
colors it, as tables: `bins`, each source's scores as the worker ships them
at this zoom (the bin's score, and its min and max where the file
summarizes); `marks`, the layers the display's encoder builds from them in
paint order (the aggregate, and under a min-max extent the tinted max and
min bands, or a line's min-to-max `band`), each mark in the color it paints
and reaching down to `low`, the band's min or the origin bars grow from; `domain`, the score axis the
display autoscales to under `scales.y`; `rules`, the reference lines it
draws; and `ramps`, the color bar its key shows where one ramp paints every
row (`rampKeyOf`). For a host that draws them itself, such as R through V8. The
adapters must be registered on `pluginManager` (`registerWiggleAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, region, regions, display, bpPerPx, trackType, }: WiggleTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/tables.ts)
