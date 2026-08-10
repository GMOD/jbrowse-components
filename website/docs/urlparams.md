---
title: URL query parameter API
sidebar_label: URL parameters
description:
  Drive JBrowse Web from the URL with loc, assembly, tracks, and the session
  spec that launches any view type
---

JBrowse Web supports URL parameters for initializing a session.

Embedded components like @jbrowse/react-linear-genome-view2 make no assumptions
about URL parameters. The consuming application must implement that logic
itself.

## Query string or hash fragment

Every parameter on this page works in either place: `?config=…&loc=…` or
`#config=…&loc=…`. A fragment is never sent to the server, so a long value — an
`encoded-`/`json-` session, a whole [session spec](#session-spec), a big
`&sessionTracks=` — cannot trip the request-line limit that answers a long query
string with HTTP 414. That is why the Share button writes its two inline formats
as hash URLs.

The two are not mixed. If the fragment contains an `=`, JBrowse reads its
parameters only from there and ignores the query string, so moving one long
parameter into the fragment means moving them all:
`?config=my.json#session=spec-{…}` loads the default `config.json`, not
`my.json`.

## Linear genome view (simple)

A simplified URL format for launching a single linear genome view:

`http://host/jbrowse2/?config=test_data/config.json&loc=chr1:6000-7000&assembly=hg19&tracks=gene_track,vcf_track`

The allowed query parameters are listed below. `&assembly=`, `&loc=`,
`&regions=`, `&nav=`, `&tracks=`, `&tracklist=`, and `&highlight=` apply only to
this single linear genome view launch. `?config=`, `&sessionName=`, `&hubURL=`,
`&renderer=`, and `&session=` work for any launch type.

### ?config=

Example

`?config=test_data/volvox/config.json`

A path to a JBrowse 2 config file, relative to the current folder on disk. This
uses a client-side fetch, not a server-side file read. If `?config=` is omitted,
JBrowse looks for `config.json` in the current folder (e.g.
`http://host/jbrowse2/config.json`), which is what the `@jbrowse/cli` tool sets
up by default.

The special value `?config=none` skips loading a config file entirely. This is
useful with `&hubURL=` (below), which supplies its own assemblies and tracks.

To change the default without putting `?config=` in every link, set
`window.__jbrowseConfigPath` in the `<head>` of JBrowse's index.html — see
[](/docs/config_guides/avoiding_stale_config), which uses the same mechanism. An
explicit `?config=` still wins over it.

### &assembly=

Example

`&assembly=hg19`

`&assembly=` refers to the `name` field of an entry in the `assemblies` array of
config.json.

### &loc=

Example

`&loc=chr1:6000-7000`

Navigates to this region on load. Accepts the formats shown below.

Example strings

```
&loc=chr1:6000-7000 // using - notation for range
&loc=chr1:6000..7000 // using .. notation for range
&loc=chr1:7000 // centered on this position
&loc=chr1 // the whole of one chromosome
&loc=chr1%206000%207000 // refName, start and end, whitespace separated
&loc=chr1:34M-35M // coordinates abbreviated with a unit suffix
&loc=GENEID // if you have used `jbrowse text-index`
```

A coordinate may be written with a `k`, `M` or `G` suffix, optionally followed
by `b` or `bp`, so `chr1:34M-35M`, `chr1:1.5Mb-2Mb` and `chr1:500kb-600kb` are
all accepted. These are expanded to whole base pairs on load, and the location
box then reads back the full number.

Navigating via `&loc=GENEID` requires a text index built with
`jbrowse text-index`.

Several whitespace-separated locstrings open a discontinuous view showing each
region in turn, which is the only way to frame several loci inside one view — a
gene and the partner it is fused to, an allele beside the sequences it derives
from. The space is URL-encoded as `%20`:

`&loc=chr3:25,325,000-25,361,000%20chr10:58,716,500-58,718,500`

This is the same form the location box displays once a view holds more than one
region, so what you copy out of it pastes back into a URL. To open a
whole-genome view restricted to particular chromosomes instead, use
[`&regions=`](#regions).

By default `&loc=` (and `&assembly=`) start a fresh session, ignoring the
config's `defaultSession`. Add `&extendSession=true` to navigate _within_ the
`defaultSession` instead (keeping its tracks and settings), see
[Navigating within the default session](#navigating-within-the-default-session).

### &regions=

Example

`&assembly=hg38&regions=chr1,chr2,chr3`

Restricts the whole-genome overview to this comma-separated subset of the
assembly's chromosomes, in the order given, handy for dropping unplaced/alt
contigs or reordering. Names resolve through the assembly's aliases. It is
ignored when `&loc=` is set (which navigates to a single region instead), and it
requires `&assembly=`. This is the simple-URL form of the session-spec
[`displayedRegionNames`](#linear-genome-view) field, and takes the same
[globs](#glob-region-names).

### &highlight=

Example

`&highlight=chr1:6000-7000`

Creates a highlight over the specified region when combined with
[&assembly=](#assembly) and [&loc=](#loc).

Multiple highlight locations can be specified by delimiting locations with a
space (URL-encoded as `%20`):

`&highlight=chr1:6000-7000%20chr1:7100-7200`

Note: always pass `&assembly=` alongside `&highlight=`. Highlights are stored by
assembly name so downstream features (e.g. bookmarking from the chip menu) can
resolve them. Without one, a highlight still renders when its refName matches a
displayed region, but it is not portable across assemblies and may break actions
that need a fully-qualified region. The same applies to `view.highlight` in a
session JSON: include `assemblyName` on each entry.

`view.highlight` entries also accept optional `color` and `label` fields, both
when authoring a session JSON directly and via the URL by passing a JSON object
(URL-encoded) instead of a loc string:

```json
{
  "refName": "11",
  "start": 32200274,
  "end": 32203877,
  "assemblyName": "mm39",
  "color": "rgba(240, 128, 128, 0.3)",
  "label": "R2_intron"
}
```

`color` overrides the theme highlight color (used as-is, so explicit alpha is
preserved). `label` is shown inline next to the chip icon and in the chip
tooltip. URL form (URL-encode the JSON):

```
&highlight={"refName":"11","start":32200274,"end":32203877,"color":"rgba(240,128,128,0.3)","label":"R2_intron"}
```

JSON highlights use the same `%20` space delimiter, and loc strings and JSON
objects can be mixed in one `&highlight=` value.

### &tracklist=

Example

`&tracklist=true`

Opens the track selector on load. Default: false.

### &nav=

Example

`&nav=false`

Turns off the navigation bar of the linear genome view. Default true.

### &tracks=

Example

`&tracks=gene_track,vcf_track`

This is a comma-separated list of trackIds. You can find your trackIds in the
config.json. You can also refer to a trackId added by `&sessionTracks=` here.

### &sessionTracks=

`&sessionTracks=` dynamically adds a track to the session. It can also add a
`FromConfigAdapter` track, specifying features inline as JSON, so you can e.g.
add BLAST hits from the URL bar.

Example

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL%20track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}])

This creates a track with a single feature at `ctgA:100-200`.

The value is an array of track configs. Pretty-printed, the one above is:

```json
[
  {
    "type": "FeatureTrack",
    "trackId": "url_track",
    "name": "URL track",
    "assemblyNames": ["volvox"],
    "adapter": {
      "type": "FromConfigAdapter",
      "features": [
        {
          "uniqueId": "one",
          "refName": "ctgA",
          "start": 100,
          "end": 200,
          "name": "Boris"
        }
      ]
    }
  }
]
```

### &sessionName=

Example

`&sessionName=My%20Custom%20Session`

Sets the session name displayed in the header bar. It works with all session
types:

- Default sessions (loaded from config)
- Session specs (`&session=spec-...`)
- Hub sessions (`&hubURL=...`)

Use it to give URL-launched sessions a meaningful name instead of an
auto-generated one with a timestamp. URL-encode the value if it contains spaces
or special characters.

### &hubURL=

Example

`&hubURL=https://example.com/hub.txt&config=none`

Loads one or more UCSC track hubs as a session (multiple hubs as a
comma-separated list), typically combined with `?config=none` since the hub
supplies its own assemblies and tracks.

Add `&loc=` and `&assembly=` to open the hub at a particular place instead of
wherever the hub itself starts. `&assembly=` is required for this: it names one
of the hub's genomes, and without it there is nothing to resolve `&loc=`
against.

```
?config=none&hubURL=https://example.com/hub.txt&assembly=GCF_019202715.1&loc=chr1:1-100000
```

`&hubURL=` opens each hub with a single linear genome view. For anything beyond
that — several views over a hub, a workspace layout, a dotplot, or extra
`sessionTracks` — put the hub in a session spec's
[`sessionConnections`](#session-spec) instead.

See [](/docs/user_guides/hub_url) for the full workflow, including combining a
hub with a config and loading several at once.

### &renderer=

Example

`&renderer=webgl`

Pins the backend tracks are drawn with, rather than detecting one. `webgpu`,
`webgl` and `canvas2d` each pin that one: `webgl` skips WebGPU and uses WebGL2,
`canvas2d` skips both and draws in software, and `webgpu` requires WebGPU.

A pin never falls through to the next backend. If the one you named cannot
start, tracks show an error saying so — which is the point, since a flag whose
whole use is comparing two backends must not quietly answer with the other one.
Any other value is ignored, with a console warning naming the ones that work.

It is a debugging aid: trying each in turn says whether a blank or wrong-looking
track comes from the GPU path, see
[my tracks are blank or render incorrectly](/docs/faq#my-tracks-are-blank-or-render-incorrectly).
JBrowse Desktop takes the same choice as a `--renderer` command-line flag, see
[](/docs/quickstart_desktop#launching-from-the-command-line).

### Navigating within the default session

The simple params above build a fresh session and ignore the config's
`defaultSession`. To instead navigate a curated `defaultSession` while keeping
its tracks and settings, add `&extendSession=true` alongside `&loc=`:

```
?loc=chr1:100000-200000&extendSession=true
```

With `&extendSession=true`, `&loc=` (and `&tracks=`, `&highlight=`, `&nav=`,
`&tracklist=`) are applied to the **first linear genome view** of the config's
`defaultSession` instead of replacing it. The assembly comes from that view, so
`&assembly=` isn't needed.

`&sessionTracks=` (dynamically-added track configs) is not layered onto the
default session. Use a full [session spec](#session-spec) for that.

## Session spec

### Linear genome view

A "session spec" encodes a session as JSON in the URL. Each view object lists
the keys that view launches with, flat as below. A spec is arguments to a view's
launcher, so nothing is nested. A `defaultSession` in a config writes the same
settings under an `init` block instead, because there the view is a saved state
snapshot (see [Config / session files](/docs/automating#config--session-files));
moving a view between the two means reshaping it, and pasting an `init` block
into a spec is reported rather than silently ignored. The embedded
`@jbrowse/react-linear-genome-view2` component takes the `init` form via
`defaultSession.view.init` (it does not parse URLs itself).

Under the hood, each view's `type` dispatches to a `LaunchView-<type>`
[extension point](/docs/developer_guides/extension_points) that builds the view
from the remaining fields. This is also how plugins add launchable view types
(see [Plugin-provided view types](#plugin-provided-view-types)).

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-5100",
      "type": "LinearGenomeView",
      "tracks": [
        "gff3tabix_genes",
        "volvox_filtered_vcf",
        "volvox_microarray",
        "volvox_cram"
      ]
    }
  ]
}
```

The `views` array accepts multiple views opened simultaneously. Each can specify
`loc`, `tracks`, `assembly`, and view type. `loc` is optional, omitting it shows
the whole genome. Different view types accept different params: dotplot, for
example, takes two assemblies.

Two fields work on every view type: `displayName` sets the title shown in the
view header (and on its workspace tab, see
[tiled views](#tiled-views--workspaces)), and `id` pins the created view's id so
another view in the same spec can point at it (e.g. an MsaView's
`connectedViewId`).

When `loc` is omitted, `displayedRegionNames` restricts the whole-genome
overview to a subset of the assembly's chromosomes, in the order given (handy
for dropping unplaced/alt contigs, or reordering). Names resolve through the
assembly's aliases, and it is ignored when `loc` is set. This opens volvox
showing only its two contigs, order reversed:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "displayedRegionNames": ["ctgB", "ctgA"],
      "tracks": ["gff3tabix_genes"]
    }
  ]
}
```

Names may be [globs](#glob-region-names).

A `LinearGenomeView` view object accepts the same fields as the simple params
above — `nav`, `tracklist`, `highlight` — plus `grow` (expand `loc` by this
fraction on each side for context, so `0.2` pads 20%; ignored without a `loc`),
`showCenterLine`, `colorByCDS`, `showAminoAcids`, `showHighlightChips` (draw the
interactive chip on each highlight band, otherwise a bare colored band), and
`trackLabels` (`"overlapping"`, `"offset"`, or `"hidden"`). A key in neither set
is a typo, and the launcher names it in a console warning rather than dropping
it silently.

A top-level `sessionTracks` array can dynamically register tracks into the
session before the views open, equivalent to combining `&sessionTracks=` with a
simple URL:

```json
{
  "sessionTracks": [
    {
      "type": "FeatureTrack",
      "trackId": "my_track",
      "name": "My track",
      "assemblyNames": ["hg38"],
      "adapter": { "type": "FromConfigAdapter", "features": [] }
    }
  ],
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "hg38",
      "tracks": ["my_track"]
    }
  ]
}
```

A top-level `sessionAssemblies` array registers assemblies into the session, the
counterpart to `sessionTracks`. Assemblies are added _before_ the tracks and
views, so `sessionTracks` and each view's `assembly` can reference them by name.
This makes a spec fully self-contained: a novel assembly, its tracks, and the
views over them, with nothing baked into the served config (pair it with
`?config=none`):

```json
{
  "sessionAssemblies": [
    {
      "name": "my_assembly",
      "uri": "https://example.com/my_assembly.2bit"
    }
  ],
  "sessionTracks": [
    {
      "type": "FeatureTrack",
      "trackId": "my_track",
      "name": "My track",
      "assemblyNames": ["my_assembly"],
      "adapter": { "type": "FromConfigAdapter", "features": [] }
    }
  ],
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "my_assembly",
      "tracks": ["my_track"]
    }
  ]
}
```

A top-level `sessionConnections` array attaches connections — UCSC track hubs,
JBrowse hubs — to the session. Each entry is a connection config, and it stays
with the session: opening the link never writes the connection into the
config.json the instance serves, whoever opens it. Connections are added after
`sessionAssemblies` and before the tracks and views, and the spec waits for each
one to finish fetching before launching its views, so a view can name an
assembly or a trackId the connection supplies:

```json
{
  "sessionConnections": [
    {
      "type": "UCSCTrackHubConnection",
      "connectionId": "my_hub",
      "name": "My hub",
      "hubTxtLocation": { "uri": "https://example.com/hub.txt" }
    }
  ],
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "GCF_019202715.1",
      "loc": "chr1:1-100000"
    }
  ]
}
```

This is what [`&hubURL=`](#huburl) does in its simple form, written out. Use the
spec form when the hub needs more than one view, a
[layout](#tiled-views--workspaces), a view type other than the linear genome
view, or additional `sessionTracks` alongside the hub's own — none of which
`&hubURL=` can express.

A spec that lists no `views` leaves the connection to open its own view wherever
it starts (a single-file hub's `defaultPos`), which is what `&hubURL=` on its
own does. As soon as the spec has views of its own, that is taken as the launch
instruction and the connection doesn't open a competing one.

You can also use `&sessionName=` with session specs to set a custom session
name:

```
&session=spec-{...}&sessionName=My%20Analysis
```

#### Glob region names

An entry in `displayedRegionNames` containing `*` is a glob matched against the
refName, which is what makes a fragmented assembly tractable: `["*_hap1"]` beats
hand-listing sixteen scaffolds and survives the assembly being rebuilt. `*` is
the only metacharacter, so a refName with regex punctuation in it (`chr1.1`,
`scaffold[2]`) still matches literally.

A glob contributes its matches in the **assembly's** order, since that is the
only order it can mean; exact names contribute in the order you wrote them, so
an explicit list still controls layout. Entries already taken are skipped, which
makes `["chr1_hap1", "*_hap1"]` read as "chr1 first, then the rest of hap1". A
name matching nothing is dropped, and a list that matches nothing at all is
reported rather than silently showing the whole genome.

The same field, and the same matching, is available on [`&regions=`](#regions),
on the [circular view](#circular-view), and on each axis of a
[dotplot](#dotplot-view).

#### Advanced track configuration

The `tracks` array can contain either simple trackId strings or objects with
additional configuration options:

```json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-5100",
      "type": "LinearGenomeView",
      "tracks": [
        "simple_track_id",
        {
          "trackId": "my_bam_track",
          "displaySnapshot": {
            "type": "LinearAlignmentsDisplay",
            "height": 300
          }
        },
        {
          "trackId": "my_wiggle_track",
          "displaySnapshot": { "minScore": 0, "maxScore": 100 }
        }
      ]
    }
  ]
}
```

Each track object supports the following properties:

- `trackId` (required): The track identifier from config.json
- `displaySnapshot` (optional): Initial display state. Can include:
  - `type`: Override the display type (e.g., `LinearBasicDisplay`,
    `LinearArcDisplay`, `LinearAlignmentsDisplay`)
  - `height`: Display height in pixels
  - `color`: Feature color for feature/wiggle tracks (a CSS color, or a `jexl:`
    expression for per-feature coloring)
  - `minScore`, `maxScore`: Score range for quantitative tracks
  - `forceLoad`: render even when the region trips the "too much data" gate, the
    declarative equivalent of the "Force load" button, which matters here
    because a URL/session has no one to click it (see
    [](/docs/config/baselineardisplay/#slot-forceload))
  - Other display-specific settings
- `trackSnapshot` (optional): Initial track state such as `pinned: true`

The `displaySnapshot` fields can also be written directly on the track object as
a shorthand:
`{ "trackId": "my_bam_track", "type": "LinearAlignmentsDisplay", "height": 300 }`
is equivalent to the `displaySnapshot` form above. Any key other than `trackId`
and `trackSnapshot` is treated as a display setting. Use the explicit
`displaySnapshot` form when you also pass `trackSnapshot`, so the two stay
visually separated.

#### Live example: alignments display settings

`displaySnapshot` is not limited to overriding the display `type`. It can set
any of the display's own settings. This opens an alignments track colored by
pair orientation, with soft-clipped bases shown and an enlarged height:

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
          "displaySnapshot": {
            "height": 250,
            "showSoftClipping": true,
            "colorBy": { "type": "pairOrientation" }
          }
        }
      ]
    }
  ]
}
```

#### Live example: linked-read bezier connections

`showBezierConnections` draws a curved connector between the mates of each
aberrant pair and across split-read junctions, so structural-variant signal
stands out over the pileup. Each curve is the same horizontal-tangent shape a
breakpoint split view draws. Coloring by pair orientation makes the abnormal
orientations easy to pick out:

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
          "displaySnapshot": {
            "height": 300,
            "showBezierConnections": true,
            "colorBy": { "type": "pairOrientation" }
          }
        }
      ]
    }
  ]
}
```

#### Live example: feature track color

Setting a track's color is one of the most common things people want to do. For
a feature track (genes, BED, GFF), put `color` in the `displaySnapshot`. It
accepts a plain CSS color, or a `jexl:` expression to color per-feature. This
opens the genes track colored green:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-50000",
      "type": "LinearGenomeView",
      "tracks": [
        {
          "trackId": "gff3tabix_genes",
          "displaySnapshot": {
            "color": "green"
          }
        }
      ]
    }
  ]
}
```

To color by a feature attribute, use a jexl expression, e.g.
`"color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"`.

### Circular view

The circular view shows the whole genome, so there is no `loc`. It takes
`assembly`, `tracks`, `displayedRegionNames` (which chromosomes get an arc, in
that order — [globs](#glob-region-names) allowed, so a circle can drop the
unplaced contigs that would otherwise each claim a wedge), and `height`. The
circle auto-fits its container, so `height` is what sizes the drawing.

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "assembly": "volvox",
      "type": "CircularView",
      "tracks": ["volvox_sv_test"]
    }
  ]
}
```

### Dotplot view

Example (self-vs-self alignment):

```json live config=test_data/volvox/config_main_thread.json
{
  "views": [
    {
      "type": "DotplotView",
      "views": [
        {
          "assembly": "volvox"
        },
        {
          "assembly": "volvox"
        }
      ],
      "tracks": ["volvox_fake_synteny"]
    }
  ]
}
```

Each entry in the `views` array also accepts an optional `loc` to navigate that
axis to a specific region (`views[0]` is the horizontal axis, `views[1]` the
vertical); omit `loc` for a whole-genome overview. An entry can also carry
`displayedRegionNames`, which is a different thing: `loc` navigates _within_
what an axis displays, `displayedRegionNames` changes what it displays at all.
That is what a haplotype-resolved assembly needs — `["*_hap1"]` on one axis
plots one haplotype against the reference instead of interleaving both
([globs](#glob-region-names) allowed). It is applied before `autoDiagonalize`,
so the reorder runs over the restricted set.

```json
{
  "views": [
    {
      "type": "DotplotView",
      "views": [
        { "assembly": "volvox", "loc": "ctgA:1-50000" },
        { "assembly": "volvox", "loc": "ctgA:1-50000" }
      ],
      "tracks": ["volvox_fake_synteny"]
    }
  ]
}
```

#### Dotplot view init options

Like the synteny view, the dotplot spec accepts extra top-level fields applied
on load:

- `colorBy`: same color modes as the
  [synteny view](#linear-synteny-view-init-options) (e.g. `strand`, `identity`,
  `mappingQuality`), applied to each dotplot display.
- `minAlignmentLength`: hide alignments shorter than this many bp.
- `autoDiagonalize`: reorder the vertical axis to follow the horizontal axis
  after the first render, lining up the main diagonal.
- `showColorLegend`: set `false` to hide the floating color-by legend, for a
  curated figure where it would clutter the plot.

```json
{
  "views": [
    {
      "type": "DotplotView",
      "views": [{ "assembly": "volvox" }, { "assembly": "volvox" }],
      "tracks": ["volvox_fake_synteny"],
      "colorBy": "strand",
      "autoDiagonalize": true
    }
  ]
}
```

#### Dotplot highlights

The dotplot view accepts a `highlight` array in the same way the linear genome
view does (see [&highlight=](#highlight)). Each entry is a loc string (or a
URL-encoded `HighlightType` JSON object with optional `color`/`label`). A region
is drawn as a translucent **vertical** band when its assembly matches the
horizontal axis and as a **horizontal** band when it matches the vertical axis,
so on a self-vs-self plot it appears on both axes:

```json live config=test_data/volvox/config_main_thread.json
{
  "views": [
    {
      "type": "DotplotView",
      "views": [
        { "assembly": "volvox", "loc": "ctgA:1-50000" },
        { "assembly": "volvox", "loc": "ctgA:1-50000" }
      ],
      "tracks": ["volvox_fake_synteny"],
      "highlight": ["ctgA:5000-15000"]
    }
  ]
}
```

As with the linear genome view, include `assemblyName` when the band must be
tied to a specific axis assembly (e.g. a non-self plot); a bare loc string
resolves by refName against whichever axis contains it.

### Spreadsheet view

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "SpreadsheetView",
      "uri": "test_data/volvox/volvox.filtered.vcf.gz",
      "assembly": "volvox"
    }
  ]
}
```

`uri` is optional: with only an `assembly` the view opens on its import form
with that assembly already selected, rather than the first one in the config.

`fileType` is one of `VCF`, `BED`, `BEDPE`, or `STAR-Fusion`. It is otherwise
detected from the extension and falls back to `VCF`, so name it for a file the
extension doesn't identify — a URL with no extension, or the `STAR-Fusion`
output, which has none of its own.

`filterText` presets the search box, applied once the file has loaded, so a link
can open on a subset of the rows rather than on the whole callset.

### SV inspector

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "SvInspectorView",
      "uri": "test_data/volvox/volvox.dup.vcf.gz",
      "assembly": "volvox"
    }
  ]
}
```

It takes the same optional `uri`, `fileType` and `filterText` as the spreadsheet
view above, plus a `height`. The circular view draws the rows the filter leaves,
so `filterText` is what makes a chord subset reachable from a link.

### Linear synteny view

A self-self alignment is allowed:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": ["volvox_fake_synteny"],
      "views": [
        {
          "loc": "ctgA:1-30000",
          "assembly": "volvox"
        },
        {
          "loc": "ctgA:1000-31000",
          "assembly": "volvox"
        }
      ]
    }
  ]
}
```

#### Linear synteny view init options

The synteny view spec accepts extra top-level fields that set the view's initial
display state on load. This opens the same view colored by strand, with curved
ribbons and stronger opacity:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": ["volvox_fake_synteny"],
      "colorBy": "strand",
      "drawCurves": true,
      "alpha": 0.8,
      "views": [
        { "loc": "ctgA:1-30000", "assembly": "volvox" },
        { "loc": "ctgA:1000-31000", "assembly": "volvox" }
      ]
    }
  ]
}
```

Supported init fields:

- `colorBy`: one of `default`, `strand`, `track`, `query`, `target`,
  `reference`, `identity`, `meanQueryIdentity`, `mappingQuality`.
  `query`/`target` paint ribbons by source/target chromosome, useful for
  whole-genome views where the default grey blends ribbons into mud. `track`
  gives each overlaid synteny track its own palette color.
- `drawCurves`: render ribbons as bezier curves rather than straight chords.
  Reads better at whole-genome scale where straight crossings stack into noise.
- `alpha`: per-feature opacity in `[0,1]` (default `0.2`, tuned for dense
  hairballs). Raise it (~`0.4`) when `minAlignmentLength` has thinned the view.
- `minAlignmentLength`: hide chains shorter than this many bp at the renderer,
  cutting the genome-scale hairball down to the large syntenic blocks.
- `autoDiagonalize`: after tracks load, reorder the bottom axis to follow the
  top axis so the main diagonal lines up (shown behind a "Reordering
  chromosomes…" spinner). Best for whole-genome all-vs-all views.
- `levelHeights`: array of pixel heights, one per synteny strip (level). For a
  multi-way view, `levelHeights[i]` is the strip between `views[i]` and
  `views[i+1]`.
- `showColorLegend`: set `false` to hide the floating color-by legend.
- `cigarMode`: `off`, `matches`, or `full` — how much of each alignment's CIGAR
  to resolve into the ribbon.
- `fadeThinAlignmentsMode`: `auto` (default), `on`, or `off`. `auto` fades
  sub-pixel ribbons only once the view is dense enough to tangle, so a sparse
  comparison between distant species isn't washed out by the fade.
- `collapseEmptyRows`: open any genome row this spec gives no tracks collapsed
  to its ruler. The "No tracks active" block costs ~90px a row, which across a
  five-row launch is more of the viewport than the ribbons.
- `sameScale`: put every genome row on one bp/px — the coarsest row's — instead
  of fitting each to the pane width, so a size difference between rows (a genome
  duplication, polyploidy) shows as length rather than being hidden by the
  per-row stretch. Applied after `autoDiagonalize`.

Each entry in `views` is a linear genome view, so besides `loc`, `assembly` and
`tracks` it takes that view's own launch props (`trackLabels`, `colorByCDS`,
`showAminoAcids`, `showCenterLine`, `showHighlightChips`), and its `tracks`
entries take inline display options the same way the
[LGV's do](#advanced-track-configuration) — a shorter `LGVSyntenyDisplay`
height, say.

### Breakpoint split view

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "BreakpointSplitView",
      "views": [
        {
          "loc": "ctgA:1-5000",
          "assembly": "volvox",
          "tracks": ["volvox_cram"]
        },
        {
          "loc": "ctgB:1-5000",
          "assembly": "volvox",
          "tracks": ["volvox_cram"]
        }
      ]
    }
  ]
}
```

The `views` array specifies the two (or more) linear genome views that make up
the breakpoint split view. Each view can have its own location, assembly, and
tracks, and each `tracks` entry takes inline display options the same way the
[LGV's do](#advanced-track-configuration).

Alongside `views`, the spec accepts every setting the view's menu offers:
`height`, `showIntraviewLinks` (the links that stay within one panel, on by
default), `linkViews` (sync scroll and zoom across the panels, off by default),
`interactiveOverlay` (clickable alignment squiggles, on by default), and
`showHeader`.

### Linear synteny view (multi-way)

The `tracks` field is a multidimensional array. Each sub-array corresponds to
the synteny tracks at one level of the multi-way view:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": [["volvox_ins.paf"], ["volvox_del.paf"]],
      "views": [
        { "loc": "ctgA:1-50000", "assembly": "volvox_ins" },
        { "loc": "ctgA:1000-50000", "assembly": "volvox" },
        { "loc": "ctgA:1000-44000", "assembly": "volvox_del" }
      ]
    }
  ]
}
```

### Plugin-provided view types

A plugin makes its view launchable from a spec by registering a
`LaunchView-<type>` [extension point](/docs/developer_guides/extension_points).
Once the plugin is loaded (via the config's `plugins`, a hosted config, or a
session's own [`sessionPlugins`](#loading-a-plugin-from-a-url) — a spec has no
field of its own for it), a session spec can launch its view by `type`. Their
spec fields are documented by each plugin, not here:

- `ProteinView` (3D structures) from `jbrowse-plugin-protein3d`. Fields such as
  `uniprotId`, `transcriptId`, `url`, and `connectedView` are documented in the
  plugin's
  [DEVELOPERS.md](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md).
  See also the [protein structures tutorial](/docs/tutorials/protein_structure).
- `MsaView` (multiple sequence alignments) from `jbrowse-plugin-msaview`. Fields
  such as `msaFileLocation`, `treeFileLocation`, and `connectedViewId` are
  documented in the plugin's
  [DEVELOPERS.md](https://github.com/GMOD/jbrowse-plugin-msaview/blob/main/DEVELOPERS.md).

### Tiled views / Workspaces

You can use the `layout` parameter in a session spec to arrange multiple views
into a tiled workspace layout. The `layout` parameter uses a nested structure
where each node is either:

- A panel (has `views` array) displays views stacked vertically
- A container (has `children` array) arranges children horizontally, vertically,
  or as tabs

#### Horizontal split example

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:5000-10000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:1-5000",
      "tracks": ["gff3tabix_genes"]
    }
  ],
  "layout": {
    "direction": "horizontal",
    "children": [{ "views": [0, 1] }, { "views": [2] }]
  }
}
```

This creates a left-right split:

- Left panel contains views 0 and 1 stacked vertically
- Right panel contains view 2

#### Custom panel sizes

You can specify the `size` property to control the proportional width/height of
panels:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:1-5000",
      "tracks": ["gff3tabix_genes"]
    }
  ],
  "layout": {
    "direction": "horizontal",
    "children": [
      {
        "views": [0],
        "size": 70
      },
      {
        "views": [1],
        "size": 30
      }
    ]
  }
}
```

This creates a 70/30 split with the left panel taking 70% of the width.

`size` applies to the **top-level split only**, and only when every one of its
panels carries one. Sizes on a nested container, or a top-level split where one
panel is left unsized, are ignored — the layout still builds, but those panels
share the space evenly, and a notification says so. Drag the divider to adjust
from there; the position is saved with the session.

#### Tabs instead of a split

`"direction": "tabs"` puts its children in one tab group rather than dividing
the space, so only one panel is visible at a time and the rest are a click away.
Useful when the views are alternatives to each other rather than things to
compare side by side:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["volvox_sv_test"]
    }
  ],
  "layout": {
    "direction": "tabs",
    "children": [{ "views": [0] }, { "views": [1] }]
  }
}
```

Both panels land in the same tab group; the first is the one shown. Tabs can be
renamed by double-clicking them, and dragged out into a split at any time.

Mixing the two is where it gets useful — a fixed reference panel on the left,
and a set of tabs to page through on the right:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["volvox_sv_test"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:1-5000",
      "tracks": ["gff3tabix_genes"]
    }
  ],
  "layout": {
    "direction": "horizontal",
    "children": [
      { "views": [0] },
      {
        "direction": "tabs",
        "children": [{ "views": [1] }, { "views": [2] }]
      }
    ]
  }
}
```

#### Complex nested layout example

You can create more complex layouts by nesting containers:

```json live config=test_data/volvox/config.json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:5000-10000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:1-5000",
      "tracks": ["gff3tabix_genes"]
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:5000-10000",
      "tracks": ["gff3tabix_genes"]
    }
  ],
  "layout": {
    "direction": "horizontal",
    "children": [
      {
        "views": [0, 1]
      },
      {
        "direction": "vertical",
        "children": [
          {
            "views": [2]
          },
          {
            "views": [3]
          }
        ]
      }
    ]
  }
}
```

This creates:

- Left panel with views 0 and 1 stacked
- Right side split vertically into two panels (view 2 on top, view 3 on bottom)

The `layout` parameter:

- Automatically enables workspaces mode
- `direction` can be `"horizontal"` (left-right), `"vertical"` (top-bottom), or
  `"tabs"` (one tab group, one panel visible at a time)
- `views` is an array of view indices (referencing the `views` array)
- `size` is an optional number giving a panel's proportion of the top-level
  split; it is honoured only there, and only when every panel of that split
  carries one (see [Custom panel sizes](#custom-panel-sizes))
- Views within the same panel are stacked vertically
- Layouts can be nested arbitrarily deep

## Other session options

### &session=json-

Like encoded sessions but more readable, `&session=json-` takes a plain JSON
snapshot of a session. Unlike a session spec (which runs extra logic to build
the session), a JSON session is a literal snapshot, the same shape produced by
"Export session...".

The Share button's gear icon offers this as "Plaintext JSON": the longest of the
three formats, and the one to pick when you want to read what the session
actually contains.

Example

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"name":"MsaView","url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

This loads a session with an extra plugin loaded.

#### Loading a plugin from a URL

The `sessionPlugins` array above is the only way to name a plugin in the URL
itself: no query parameter takes one, and a [session spec](#session-spec) has no
field for it, so anything else has to come from the config JBrowse loads. It
takes the same definitions a config's `plugins` array takes, and works in every
session format that carries a snapshot — `json-`, `encoded-`, `share-` and
`local-`. A plugin loaded this way belongs to that session rather than being
installed for the user, and travels with it through the Share button.

Four things to know before writing one by hand:

- **`name` is required for a UMD bundle** — the `.umd.production.min.js` builds
  the plugin store publishes. The loader resolves the bundle as the global
  `JBrowsePlugin<Name>`, so a definition carrying only a `url` loads the script
  and then finds nothing in it.
- **An unrecognized plugin prompts the visitor.** Anything not served from
  `https://jbrowse.org/plugins/` and not listed in the
  [plugin store](https://jbrowse.org/jb2/plugin_store/) opens a "this session
  has the following unknown plugins" dialog, naming each one, before the session
  loads — a plugin is arbitrary javascript running with the page's privileges,
  and a session URL arrives from whoever sent it. Accepting can remember that
  url for this origin. A config's `plugins` are gated the same way, but only
  when the config is cross-origin, which is why a config served beside JBrowse
  never prompts.
- **A JSON session is state, not spec shorthand.** Opening a plugin's view type
  this way means writing that view's real snapshot, not the flat
  [spec](#plugin-provided-view-types) arguments its launcher takes. Build the
  session in the app and copy it out of Share → gear → "Plaintext JSON" rather
  than authoring one from scratch.
- **These URLs get long.** Put the session
  [in the fragment](#query-string-or-hash-fragment) to stay under the
  request-line limit that answers a long query string with HTTP 414 — and note
  that a fragment containing `=` makes JBrowse ignore the query string
  altogether, so `?config=…#session=json-…` loads the default `config.json`, not
  the named one. Move `config=` into the fragment as well.

If the point is for everyone opening a config to have the plugin, put it in that
config's own `plugins` array instead. `sessionPlugins` is for one session, or
one link.

### &session=encoded-

Similar to JSON sessions but uses a URL encoding (base64+gzip), so the URLs look
like:

```
https://jbrowse.org/code/jb2/latest/#session=encoded-eJyNU2FzmkAQ_SvOfaaNIKDyLbFN0xlrTWRqnU4mc8ACm8BB7k6Ndfj...
```

The "Share" button's gear icon has a "Long URL" option that produces these.
Because the entire session is encoded in the URL, they work without the central
session-sharing system in place — and because that makes the URL long, the Share
button puts it [in the fragment](#query-string-or-hash-fragment) rather than the
query string. `?session=encoded-` is read the same way.

### &session=local-

The local sessions look like this

https://host/jbrowse2/?session=local-Fjphq8kjY

By default, after a session is loaded, it is stored into sessionStorage and
IndexedDB, and then the URL bar uses the ?session=local- format to reflect the
session ID. Pasting the URL in the same browser tab restores from
sessionStorage. Pasting it into a new tab on the same machine restores from
IndexedDB.

### &session=share-

If you click the "Share" button in the header bar, it will generate a "shareable
link" that you can give to other users

https://host/jbrowse2/?session=share-HShsEcnq3i&password=nYzTU

See
[this FAQ entry for more info about how shared sessions work](/docs/faq/#how-does-session-sharing-with-shortened-urls-work-in-jbrowse-web)

## See also

- [](/docs/config_and_session_json)
- [](/docs/automating)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/config_guides/default_session)
- [](/docs/developer_guides/extension_points)
