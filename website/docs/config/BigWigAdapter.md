---
id: bigwigadapter
title: BigWigAdapter
sidebar_label: Adapter -> BigWigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://example.com/coverage.bw',
  },
}
```

`coverage.bw` infers `BigWigAdapter` and `QuantitativeTrack` on its own, so the
same track can be written as an id and a uri. `name` then defaults to the file
name, and `assemblyNames` is implied for a config holding one assembly — see
[the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/coverage.bw',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

used to load BigWig quantitative signal files

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BigWigAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bigwiglocation">**bigWigLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bw', locationType: 'UriLocation' }</code> | location of the BigWig file. It carries its own index and precomputed zoom levels, so there is no separate index to configure and a whole-chromosome view reads summary bins rather than every point. |
| <span id="slot-source">**source**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | added as feature.get('source') on all features |
| <span id="slot-resolutionmultiplier">**resolutionMultiplier**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Resolution multiplier applied to every fetch: <1 fetches more points (higher resolution), >1 fetches fewer (e.g. 2 = half as many points)<br>_advanced_ |
