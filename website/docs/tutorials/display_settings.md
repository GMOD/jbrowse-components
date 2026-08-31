---
title: Display settings
description:
  Change a track's height, color and soft clipping, then make the change stick
  in a link, a session file, or config.json
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

**TL;DR:** every setting in a track menu has a name, and JBrowse will tell you
what it is. Change the setting by clicking, read the session JSON back, and the
same key works in a shareable link, in a saved session file, and in
`config.json`. This page changes four settings on one CRAM track and follows
them through all three.

## Prerequisites

- JBrowse Web or JBrowse Desktop. Both are covered at each step.
- Nothing to download. The volvox demo data is hosted.

## Open the reads track

Volvox is the small demo dataset the JBrowse test builds ship, and
`volvox-sv (cram)` is its structural-variant CRAM.

In **JBrowse Web**, open
[volvox at ctgA:1-10,000](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-10000&tracks=volvox_sv_cram).

In **JBrowse Desktop**, choose **File → Session → Open JBrowse Web link...** and
paste that same URL, or **File → Session → Open config.json or .jbrowse
file...** and give it
`https://jbrowse.org/code/jb2/main/test_data/volvox/config.json`. Desktop reads
a config you open and leaves it alone, saving your edits to a session of its
own.

Either way you get a pileup of short reads, drawn at the default height in the
default gray.

## Change four settings

Open the track's menu from the track label, and set:

- **Color by... → Paired end → Insert size and orientation**, which leaves
  normally-paired reads gray and colors the rest by how they disagree with the
  reference.
- **Read connections → View as pairs / link supplementary alignments**, which
  puts each read on the same row as its mate.
- **Show... → Show soft clipping**, which draws the clipped ends the aligner
  trimmed off.

Then drag the bottom edge of the track down to about 250px, so the deeper stack
of paired rows fits.

<Figure caption="The volvox-sv (cram) track at ctgA:1-10,000 as a 250px-tall pileup, soft-clipping shown, reads viewed as pairs and colored by insert size and orientation. The colored cluster at the left flags a structural variant." src="/img/display_settings_url_snapshot.png" />

## Ask JBrowse what you just set

Three menu clicks and a drag changed four settings, and each one has a name you
can type into a config.

In **JBrowse Web**, click **Share**, take **Plaintext JSON** from the settings
icon in the dialog, and tick the **Show readable JSON** box that arrives with
it. In **JBrowse Desktop**, choose **File → Session → Save session as...**, save
a `volvox.jbrowse` file, and open it in a text editor.

<Video src="/media/config/settings_to_json.mp4" caption="Three settings taken from the volvox-sv (cram) track menu, then the share dialog's settings icon, Plaintext JSON, and the readable session panel that arrives with it." />

Both hold the same JSON. Each of the four is a write to the track's own config,
so they arrive together under `trackConfigDeltas`, keyed by the track id you
edited:

```json
"trackConfigDeltas": {
  "volvox_sv_cram": {
    "displays": [
      {
        "displayId": "volvox_sv_cram-LinearAlignmentsDisplay",
        "height": 250,
        "linkedReads": "normal",
        "colorBy": { "type": "insertSizeAndOrientation" },
        "showSoftClipping": true
      }
    ]
  }
}
```

`height`, `linkedReads`, `colorBy` and `showSoftClipping` are the setting names,
and every route below spells them the same way.

Change one more setting in the app, wait a second, and read `volvox.jbrowse`
again: Desktop autosaves the open session about a second after each edit, and
reopening that file brings the settings back.

The [config schema docs](/docs/config_guide) list the same names per display
(e.g. [](/docs/config/linearalignmentsdisplay),
[](/docs/config/linearwiggledisplay)) with what each one accepts, which is where
to go for a setting you have not clicked yet.

## Put the settings in config.json

A session remembers settings for one session. To have the track open this way
for everyone, every time, put the same keys in its `displayDefaults`:

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
    "colorBy": { "type": "insertSizeAndOrientation" },
    "showSoftClipping": true
  }
}
```

JBrowse routes each key in `displayDefaults` to the display that uses it. Spell
out the full `displays` array when you are _selecting_ a non-default display
type (`LinearMultiSampleVariantDisplay`, `LDDisplay`, and so on); see
[configuring tracks](/docs/config_guides/tracks) for both forms.

Reload with that config and the track opens paired, colored and soft-clipped,
with no clicking.

## Precedence when config and session disagree

Now both places are set, so make them disagree. The config above asks for
`height: 250`. Load a session that asks for 100 on the same track:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-10000",
      "type": "LinearGenomeView",
      "tracks": [
        {
          "trackId": "volvox_sv_cram",
          "height": 100,
          "colorBy": { "type": "insertSizeAndOrientation" }
        }
      ]
    }
  ]
}
```

The track comes up 100px tall. The session wins, and it wins per setting: a key
the session does not mention still comes from `displayDefaults`.

Each entry in a view's `tracks` array is either a plain `trackId` string or an
object with `trackId` plus settings written alongside it, as above. The settings
can equivalently be nested under an explicit `displaySnapshot` key
(`{ "trackId": "...", "displaySnapshot": { "height": 100 } }`); the inline form
is shorthand for it. Use the explicit form when you also need `trackSnapshot`
for track-config fields.

## Where each route keeps the value

| Route                              | Kept in                  | Applies to                                |
| ---------------------------------- | ------------------------ | ----------------------------------------- |
| The pin beside a menu row          | your browser, or the app | every track of that display type, for you |
| **Share** link (`?session=`)       | the URL                  | whoever opens that link                   |
| **Save session as...** (Desktop)   | the `.jbrowse` file      | whoever opens that file                   |
| `displayDefaults` in `config.json` | the config file          | everyone, every session                   |

The pin is the one route with no file in it, and the only one a reader of your
instance can reach without your help;
[defaults for all tracks](/docs/user_guides/display_defaults) covers it.
`?session=` URLs are a JBrowse Web feature, since Desktop has no session-URL
server; Desktop's nearest equivalent is **File → Session → Export session to
web...**, which uploads the session and hands you a web link with the settings
encoded in it.

[URL parameters](/docs/urlparams) has the full session-spec format, including
`trackSnapshot` and multi-view specs.

## In an embedded component

The embedded React components take the same keys through the `init` prop:

```js
init: {
  loc: 'ctgA:1105..3000',
  assembly: 'volvox',
  tracks: [
    {
      trackId: 'volvox_microarray',
      type: 'LinearWiggleDisplay',
      defaultRendering: 'line',
      height: 150,
    },
  ],
}
```

See [embedding the linear genome view](/docs/tutorials/embed_linear_genome_view)
for the surrounding setup.

## See also

- [](/docs/user_guides/display_defaults)
- [](/docs/config_guides/tracks)
- [](/docs/urlparams)
- [](/docs/tutorials/cli_desktop)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/config_guide)
