---
id: bigbedadapter
title: BigBedAdapter
sidebar_label: Adapter -> BigBedAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BigBedAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigBedAdapter',
    uri: 'https://example.com/features.bb',
  },
}
```

`features.bb` infers `BigBedAdapter` and `FeatureTrack` on its own, and `name`
defaults to the file name, so the whole track is its id, its uri and its
assembly. A config declaring one assembly supplies that last one too, leaving
`{ trackId, uri }` — see
[the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/features.bb',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BigBedAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bigbedlocation">**bigBedLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bb', locationType: 'UriLocation' }</code> | location of the BigBed file. It carries its own index and summary zoom levels, so there is no separate index to configure. |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The column to use as a "score" attribute |
| <span id="slot-aggregatefield">**aggregateField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'geneName2'</code> | An attribute to aggregate features with |
| <span id="slot-disablegeneheuristic">**disableGeneHeuristic**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |
