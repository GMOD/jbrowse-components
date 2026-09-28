---
title: Display settings
description:
  Change a track's height, color and read pairing, then make the change stick in
  a link, a session file, or config.json
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

Every setting in a track menu has a name, and the same name works in a shareable
link, in a saved session file, and in `config.json`. We set three on one CRAM
track, `height`, `linkedReads` and `color`, and follow them into each of those.

## Prerequisites

- [JBrowse Web](/docs/quickstart_web) or
  [JBrowse Desktop](/docs/quickstart_desktop)

## Put the settings in displayDefaults

The keys of a track's `displayDefaults` apply every time the track loads, and in
a served `config.json` they apply for every visitor. This track opens 250px
tall, with each read on the same row as its mate and colored by insert size and
orientation:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_sv_cram",
  "name": "volvox-sv (cram)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "volvox-sv.cram"
  },
  "displayDefaults": {
    "height": 250,
    "linkedReads": "normal",
    "color": { "field": "insertSizeAndOrientation" }
  }
}
```

JBrowse routes each key in `displayDefaults` to the display that uses it. Spell
out the full `displays` array when selecting a non-default display type
(`LinearMultiSampleVariantDisplay`, `LDTrackDisplay`, and so on); see
[configuring tracks](/docs/config_guides/tracks) for both forms. The
[config schema docs](/docs/config_guide) list every setting per display, for
example [](/docs/config/linearalignmentsdisplay).

<details>
<summary>Find a setting's name by clicking</summary>

The volvox demo data is hosted, and `volvox-sv (cram)` is its structural-variant
CRAM. In **JBrowse Web**, open
[volvox at ctgA:1-10,000](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-10000&tracks=volvox_sv_cram).
In **JBrowse Desktop**, choose **File → Session → Open JBrowse Web link...** and
paste that URL. Desktop leaves a config you open unchanged and saves your edits
to a separate session file.

Open the track's menu from the track label and set:

- **Color by... → Paired end → Insert size and orientation**
- **Read connections → View as pairs / link supplementary alignments**

Then drag the bottom edge of the track down to about 250px.

<Figure caption="The volvox-sv (cram) track at ctgA:1-10,000 as a 250px-tall pileup, reads viewed as pairs and colored by insert size and orientation. The colored cluster at the left flags a structural variant." src="/img/display_settings_url_snapshot.png" />

In JBrowse Web, click **Share** and tick **Show readable JSON**:

<Video src="/media/config/settings_to_json.mp4" caption="Two settings chosen from the volvox-sv (cram) track menu, then the share dialog with Show readable JSON ticked to display the session." />

The session JSON lists the three settings under `trackConfigDeltas`, keyed by
the id of the track you edited, because JBrowse Web saves an edit to a
configured track as only the settings that changed:

```json
"trackConfigDeltas": {
  "volvox_sv_cram": {
    "displays": [
      {
        "displayId": "volvox_sv_cram-LinearAlignmentsDisplay",
        "height": 250,
        "linkedReads": "normal",
        "color": { "field": "insertSizeAndOrientation" }
      }
    ]
  }
}
```

In JBrowse Desktop, choose **File → Session → Save session as...** and open the
`volvox.jbrowse` file in a text editor. Desktop writes a track edit into the
`volvox_sv_cram` entry of the file's `tracks` array, and autosaves about a
second after each edit.

</details>

## Precedence when config and session disagree

A session can set a key that a track's `displayDefaults` also sets. The volvox
config ships a gene track, `gff3tabix_genes_shorthand_jexl`, whose
`displayDefaults` set two keys: `color`, a jexl expression that draws
plus-strand features blue and minus-strand ones red, and `labels`, which names
each feature with its type in brackets. This session sets `color` on that track
and nothing else:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-25000",
      "type": "LinearGenomeView",
      "tracks": [
        {
          "trackId": "gff3tabix_genes_shorthand_jexl",
          "color": "#8c8c8c"
        }
      ]
    }
  ]
}
```

The features draw grey and their labels still read `seg04 [match]`. A session
value overrides `displayDefaults` one key at a time, so the session's `color`
replaces the config's and `labels` still comes from `displayDefaults`. A session
that sets `height: 100` on the alignments track draws it 100px tall and keeps
the paired coloring.

An entry in a view's `tracks` array is either a `trackId` string or an object
with `trackId` plus settings written alongside it. The explicit form nests the
settings under `displaySnapshot`, and is needed when the entry also sets
`trackSnapshot` for track-config fields.

## Where each route keeps the value

| Route                              | Kept in             | Applies to              |
| ---------------------------------- | ------------------- | ----------------------- |
| **Share** link (`?session=`)       | the URL             | whoever opens that link |
| **Save session as...** (Desktop)   | the `.jbrowse` file | whoever opens that file |
| `displayDefaults` in `config.json` | the config file     | everyone, every session |

`?session=` URLs need JBrowse Web. Desktop's nearest equivalent is **File →
Session → Export session to web...**, which gives a web link with the settings
encoded in it. [URL parameters](/docs/urlparams) has the full session-spec
format.

## In an embedded component

The embedded React components take the same keys through the `view` prop:

```js
view: {
  loc: 'ctgA:1105..3000',
  tracks: [
    {
      trackId: 'volvox_microarray',
      type: 'LinearWiggleDisplay',
      mark: 'line',
      height: 150,
    },
  ],
}
```

See [embedding the linear genome view](/docs/tutorials/embed_linear_genome_view)
for the surrounding setup.

## See also

- [](/docs/config_guides/tracks)
- [](/docs/urlparams)
- [](/docs/tutorials/cli_desktop)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/config_guide)
