---
title: Display settings
description:
  Change a track's height, color and read pairing, then make the change stick in
  a link, a session file, or config.json
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

Every setting in a track menu has a name you can type into a config. We change
three settings on one CRAM track by clicking, read their names back out of the
session JSON, and use those names in a shareable link, a saved session file and
`config.json`.

## Prerequisites

- [JBrowse Web](/docs/quickstart_web) or
  [JBrowse Desktop](/docs/quickstart_desktop). The steps follow JBrowse Web, and
  a collapsed **In JBrowse Desktop** note covers each step that differs.

## Open the volvox structural-variant CRAM track

Volvox is the small demo dataset the JBrowse test builds ship, and
`volvox-sv (cram)` is its structural-variant CRAM. Open
[volvox at ctgA:1-10,000](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-10000&tracks=volvox_sv_cram).
The track opens as a pileup of short reads at the default height, in the default
gray.

<details>
<summary>In JBrowse Desktop</summary>

Choose **File → Session → Open JBrowse Web link...** and paste the link above,
or **File → Session → Open config.json or .jbrowse file...** and give it
`https://jbrowse.org/code/jb2/main/test_data/volvox/config.json`. Desktop leaves
a config you open unchanged and saves your edits to a separate session file.

</details>

## Change height, color and read pairing from the track menu

Open the track's menu from the track label, and set:

- **Color by... → Paired end → Insert size and orientation**, which leaves
  normally-paired reads gray and colors the rest by how they disagree with the
  reference.
- **Read connections → View as pairs / link supplementary alignments**, which
  puts each read on the same row as its mate.

Drag the bottom edge of the track down to about 250px, so the deeper stack of
paired rows fits.

<Figure caption="The volvox-sv (cram) track at ctgA:1-10,000 as a 250px-tall pileup, reads viewed as pairs and colored by insert size and orientation. The colored cluster at the left flags a structural variant." src="/img/display_settings_url_snapshot.png" />

## Read the setting names back out of the session JSON

Click **Share** and tick the **Show readable JSON** box below the link.

<Video src="/media/config/settings_to_json.mp4" caption="Two settings chosen from the volvox-sv (cram) track menu, then the share dialog with Show readable JSON ticked to display the session." />

JBrowse Web saves an edit to a configured track as the settings that changed, so
the session JSON lists the three settings under `trackConfigDeltas`, keyed by
the id of the track you edited:

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

<details>
<summary>In JBrowse Desktop</summary>

Choose **File → Session → Save session as...**, save a `volvox.jbrowse` file,
and open it in a text editor. A `.jbrowse` file is a whole config with the
session under `defaultSession`. Desktop writes a track edit into that config, so
the three keys appear in the `volvox_sv_cram` entry of the file's `tracks`
array. Desktop autosaves the open session to the file about a second after each
edit, and reopening the file restores every setting.

</details>

`height`, `linkedReads` and `color` are the setting names in both apps. The
[config schema docs](/docs/config_guide) list the names each display takes (e.g.
[](/docs/config/linearalignmentsdisplay), [](/docs/config/linearwiggledisplay))
and the values each accepts. The same read-back finds the key for any other
setting on any track: change it in the menu, share, and read the new key in the
JSON.

## Put the three settings in a track's displayDefaults

Settings saved in a session apply when that session opens. The same keys in a
track's `displayDefaults` apply every time the track loads, and in a served
`config.json` they apply for every visitor:

```json addtrack
{
  "trackId": "volvox_sv_cram",
  "name": "volvox-sv (cram)",
  "uri": "volvox-sv.cram",
  "assemblyNames": ["volvox"],
  "displayDefaults": {
    "height": 250,
    "linkedReads": "normal",
    "color": { "field": "insertSizeAndOrientation" }
  }
}
```

With this config the track opens paired and colored. To select a non-default
display type (`LinearMultiSampleVariantDisplay`, `LDTrackDisplay`), write a
`displays` array; [configuring tracks](/docs/config_guides/tracks) covers both
forms.

## When a session and the track config set the same setting

A session value overrides a track's `displayDefaults` one key at a time. The
volvox config ships a gene track, `gff3tabix_genes_shorthand_jexl`, whose
`displayDefaults` set `color`, a jexl expression that draws plus-strand features
blue and minus-strand ones red, and `labels`, which names each feature with its
type in brackets. This session sets `color` on that track and nothing else:

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

The session's `color` replaces the config's, so the features draw grey, and
their labels still read `seg04 [match]` from `displayDefaults`.[^snapshot] The
CRAM track from the first sections follows the same rule, so a session that sets
`height: 100` on it draws the track 100px tall and keeps the paired coloring
from its config.

## Where each route keeps a setting (link, session file or config)

| Route                              | Kept in             | Applies to              |
| ---------------------------------- | ------------------- | ----------------------- |
| **Share** link (`?session=`)       | the URL             | whoever opens that link |
| **Save session as...** (Desktop)   | the `.jbrowse` file | whoever opens that file |
| `displayDefaults` in `config.json` | the config file     | everyone, every session |

[URL parameters](/docs/urlparams) has the full session-spec format, including
`trackSnapshot` and multi-view specs.

<details>
<summary>In JBrowse Desktop</summary>

Desktop has no address bar to paste a `?session=` URL into. **File → Session →
Export session to web...** uploads the session and gives you a JBrowse Web link
with the settings encoded in it.

</details>

## Pass the same settings to an embedded component

The embedded React components take the same keys through the `view` prop:

```js
view: {
  loc: 'ctgA:1-10000',
  tracks: [
    {
      trackId: 'volvox_sv_cram',
      type: 'LinearAlignmentsDisplay',
      height: 250,
      linkedReads: 'normal',
      color: { field: 'insertSizeAndOrientation' },
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

[^snapshot]:
    Each entry in a view's `tracks` array is a plain `trackId` string or an
    object with `trackId` and settings written beside it. The inline settings
    are shorthand for a `displaySnapshot` key
    (`{ "trackId": "...", "displaySnapshot": { "height": 100 } }`); write the
    explicit form when you also need `trackSnapshot` for track-config fields.
