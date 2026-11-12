---
id: multiwiggleadapter
title: MultiWiggleAdapter
description: "Reads several BigWig files as the sources of one multi-row quantitative track."
sidebar_label: Adapter -> MultiWiggleAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts).

Reads several BigWig files as the sources of one multi-row quantitative
track.

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

Per-subtrack metadata from a table: the first column of `samplesTsvLocation`
names each subtrack as the adapter does (for `bigWigs`, the filename without
its extension), and the other columns ride along as source metadata. The
track shows only the subtracks the table lists:

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
    samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
  },
}
```

## Related links

- **Track:** [MultiQuantitativeTrack](../multiquantitativetrack)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "MultiWiggleAdapter", ... }`. `MultiWiggleAdapter` has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-subadapters">**subadapters**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | array of subadapter JSON objects |
| <span id="slot-bigwigs">**bigWigs**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | array of BigWig URLs/paths, alternative to the subadapters slot |
| <span id="slot-baseuri">**baseUri**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | base URL for relative bigWig URLs, stamped from the location the config was loaded from<br>_advanced_ |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`maybeFileLocation`](/docs/config_guides/slot_types#the-maybe-types) | optional tab-separated table of per-sample metadata. It needs a header row, whose first cell is not read, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the variant and wiggle displays, and a mark display over a MultiWiggle, group, sort, color and tooltip rows by, and a blank cell is no value; `label` and `color` name and color the row. A VCF's table ignores a `sampleName`, `HP` or `sole` column, with a warning, since the variant display writes those fields on its haplotype rows. A MAF adapter reads only the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, with a warning naming the rest, and a table naming none of them is an error. An adapter that names no samples (a MAF track discovering its species from the file) takes the table's rows as its samples |
