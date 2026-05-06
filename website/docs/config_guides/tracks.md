---
id: tracks
title: Configuring tracks
---

All tracks can contain:

- `trackId` - internal track ID, must be unique
- `name` - displayed track name
- `assemblyNames` - an array of assembly names a track is associated with, often
  just a single assemblyName
- `category` - (optional) array of categories to display in a hierarchical track
  selector

Example `config.json` containing a track config for a BigBed file:

File locations in adapter configs use a `{ "uri": "..." }` object. The
`"locationType": "UriLocation"` field is optional for URI locations and can be
omitted — it is only needed when the type cannot be inferred (e.g. local file
paths on desktop).

```json
{
  "assemblies": [
    ...the hg19 assembly...
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "repeats_hg19",
      "name": "Repeats",
      "assemblyNames": ["hg19"],
      "category": ["Annotation"],
      "adapter": {
        "type": "BigBedAdapter",
        "bigBedLocation": {
          "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
        }
      }
    }
  ]
}
```

A reduced form is also accepted:

```json
{
  "type": "BigBedAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
}
```
