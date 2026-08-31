---
id: fromconfigadapter
title: FromConfigAdapter
sidebar_label: Adapter -> FromConfigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      { uniqueId: 'f1', refName: 'ctgA', start: 100, end: 200, name: 'feature1' },
    ],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

supplies features inline in the config instead of reading a file, useful for
small feature sets added via a URL or session spec

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "FromConfigAdapter", ... }`. This adapter has no `uri`
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the
location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapterid">**adapterId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. optional — falls back to hash. |
| <span id="slot-features">**features**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | the features themselves, as an array of plain objects. Each needs a `uniqueId`, `refName`, `start` and `end` (0-based half-open); anything else — `name`, `type`, `score`, `strand`, nested `subfeatures` — is carried through onto the feature as-is. |
