---
id: hicadapter
title: HicAdapter
sidebar_label: Adapter -> HicAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'HicTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'HicAdapter',
    uri: 'https://example.com/map.hic',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load Hi-C contact matrix data from a `.hic` file

## Related links

- **Track:** [HicTrack](../hictrack)
- **Display:** [LinearHicDisplay](../linearhicdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "HicAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-hiclocation">**hicLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.hic', locationType: 'UriLocation' }</code> | location of the `.hic` contact matrix (Juicer / Juicebox format). It stores every resolution and its own index, so there is nothing else to configure — the display picks a bin size from the current zoom. |
