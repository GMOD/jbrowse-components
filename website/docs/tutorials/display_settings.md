---
title: Display settings
description:
  Change a track's height, color and read pairing, then make the change stick in
  a link, a session file, or config.json
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

Every setting in a track menu has a name, and JBrowse will tell you what it is.
Change the setting by clicking, read the session JSON back, and the same key
works in a shareable link, in a saved session file, and in `config.json`. We
change three settings on one CRAM track and follow them into each of those.

## Prerequisites

- [JBrowse Web](/docs/quickstart_web) or
  [JBrowse Desktop](/docs/quickstart_desktop). Both are covered at each step.
- Nothing to download. The volvox demo data is hosted.

## Open the reads track

Volvox is the small demo dataset the JBrowse test builds ship, and
`volvox-sv (cram)` is its structural-variant CRAM.

In **JBrowse Web**, open
[volvox at ctgA:1-10,000](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-10000&tracks=volvox_sv_cram).

In **JBrowse Desktop**, choose **File → Session → Open JBrowse Web link...** and
paste that same URL, or **File → Session → Open config.json or .jbrowse
file...** and give it
`https://jbrowse.org/code/jb2/main/test_data/volvox/config.json`. Desktop leaves
a config you open unchanged and saves your edits to a separate session file.

In either app the track opens as a pileup of short reads at the default height,
in the default gray.

## Change three settings

Open the track's menu from the track label, and set:

- **Color by... → Paired end → Insert size and orientation**, which leaves
  normally-paired reads gray and colors the rest by how they disagree with the
  reference.
- **Read connections → View as pairs / link supplementary alignments**, which
  puts each read on the same row as its mate.

Then drag the bottom edge of the track down to about 250px, so the deeper stack
of paired rows fits.

<Figure caption="The volvox-sv (cram) track at ctgA:1-10,000 as a 250px-tall pileup, reads viewed as pairs and colored by insert size and orientation. The colored cluster at the left flags a structural variant." src="/img/display_settings_url_snapshot.png" />

## Ask JBrowse what you just set

Two menu clicks and a drag changed three settings, and each one has a name you
can type into a config.

Click **Share** in **JBrowse Web** and tick the **Show readable JSON** box below
the link.

<Video src="/media/config/settings_to_json.mp4" caption="Two settings chosen from the volvox-sv (cram) track menu, then the share dialog with Show readable JSON ticked to display the session." />

The session JSON in that box lists the three settings under `trackConfigDeltas`,
keyed by the id of the track you edited, because JBrowse Web saves an edit to a
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

In **JBrowse Desktop**, choose **File → Session → Save session as...**, save a
`volvox.jbrowse` file, and open it in a text editor. A `.jbrowse` file is a
whole config with the session under `defaultSession`, and Desktop writes a track
edit into that config, so the same three keys appear in the `volvox_sv_cram`
entry of the file's `tracks` array.

`height`, `linkedReads` and `color` are the setting names in both apps, and
every route below spells them the same way.

Desktop autosaves the open session to `volvox.jbrowse` about a second after each
edit, so a setting you change now shows up when you reread the file, and
reopening the file restores every setting.

The [config schema docs](/docs/config_guide) list the same names per display
(e.g. [](/docs/config/linearalignmentsdisplay),
[](/docs/config/linearwiggledisplay)) with what each one accepts, which is where
to go for a setting you have not clicked yet.

## Put the settings in displayDefaults

Settings saved in a session apply when that session opens. The same keys in a
track's `displayDefaults` apply every time the track loads, and in a served
`config.json` they apply for every visitor:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_sv_cram",
  "name": "volvox-sv (cram)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "cramLocation": { "uri": "volvox-sv.cram" },
    "craiLocation": { "uri": "volvox-sv.cram.crai" }
  },
  "displayDefaults": {
    "height": 250,
    "linkedReads": "normal",
    "color": { "field": "insertSizeAndOrientation" }
  }
}
```

JBrowse routes each key in `displayDefaults` to the display that uses it. Spell
out the full `displays` array when you are _selecting_ a non-default display
type (`LinearMultiSampleVariantDisplay`, `LDTrackDisplay`, and so on); see
[configuring tracks](/docs/config_guides/tracks) for both forms.

The track then opens paired and colored, with no clicking.

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

The features draw grey, and their labels still read `seg04 [match]`. A session
value overrides `displayDefaults` one key at a time: the session's `color`
replaces the config's, and `labels`, which the session does not set, still comes
from `displayDefaults`. The alignments track above follows the same rule, so a
session that sets `height: 100` on it draws the track 100px tall and keeps the
paired coloring from its config.

Each entry in a view's `tracks` array is either a plain `trackId` string or an
object with `trackId` plus settings written alongside it, as above. The settings
can equivalently be nested under an explicit `displaySnapshot` key
(`{ "trackId": "...", "displaySnapshot": { "height": 100 } }`); the inline form
is shorthand for it. Use the explicit form when you also need `trackSnapshot`
for track-config fields.

## Where each route keeps the value

| Route                              | Kept in             | Applies to              |
| ---------------------------------- | ------------------- | ----------------------- |
| **Share** link (`?session=`)       | the URL             | whoever opens that link |
| **Save session as...** (Desktop)   | the `.jbrowse` file | whoever opens that file |
| `displayDefaults` in `config.json` | the config file     | everyone, every session |

`?session=` URLs are a JBrowse Web feature, since Desktop has no session-URL
server; Desktop's nearest equivalent is **File → Session → Export session to
web...**, which uploads the session and gives you a web link with the settings
encoded in it.

[URL parameters](/docs/urlparams) has the full session-spec format, including
`trackSnapshot` and multi-view specs.

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
