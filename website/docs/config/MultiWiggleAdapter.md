---
id: multiwiggleadapter
title: MultiWiggleAdapter
sidebar_label: Adapter -> MultiWiggleAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts).

## Example usage

The `bigWigs` shorthand: a plain array of BigWig URLs, one subtrack each
(the subtrack name is derived from the filename):
```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
}
```

Preloading per-subtrack metadata: use `subadapters` instead of `bigWigs` to
attach a `name`, a `color`, and a `group` to each subtrack. The extra keys
ride along as source metadata — `group` drives the sidebar clustering tree
and `color` sets the subtrack's line/fill on load:
```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        type: 'BigWigAdapter',
        name: 'Alpha',
        group: 'Islet',
        color: '#e6194b',
        bigWigLocation: { uri: 'https://example.com/alpha.bw' },
      },
      {
        type: 'BigWigAdapter',
        name: 'Beta',
        group: 'Islet',
        color: '#f58231',
        bigWigLocation: { uri: 'https://example.com/beta.bw' },
      },
    ],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

:::caution Gotcha

The `bigWigs` shorthand only accepts **absolute** URLs; a relative path there will not resolve against the config's location. Use the `subadapters` form for relative URLs, which is also what you need for per-subtrack `color`, `group`, and `source`.

:::

combines multiple BigWig files into a single multi-row quantitative track

## Related links

- **Track:** [MultiQuantitativeTrack](../multiquantitativetrack)
- **Display:** [MultiLinearWiggleDisplay](../multilinearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MultiWiggleAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-subadapters">**subadapters**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | array of subadapter JSON objects |
| <span id="slot-bigwigs">**bigWigs**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | array of BigWig URLs/paths, alternative to the subadapters slot |
