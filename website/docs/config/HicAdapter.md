---
id: hicadapter
title: HicAdapter
description: "Reads Hi-C contact matrices from a .hic file."
sidebar_label: Adapter -> HicAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts).

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

JBrowse infers `HicAdapter` and `HicTrack` from `map.hic`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/map.hic',
  assemblyNames: ['hg38'],
}
```

Reads Hi-C contact matrices from a `.hic` file.

## Related links

- **Track:** [HicTrack](../hictrack)
- **Display:** [LinearHicDisplay](../linearhicdisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "HicAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-hiclocation">**hicLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.hic', locationType: 'UriLocation' }</code> | location of the `.hic` contact matrix (Juicer / Juicebox format). The file holds every resolution and an index, so there is nothing else to configure — the display picks a bin size from the current zoom. |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `resolutionMultiplier` | ignored |
