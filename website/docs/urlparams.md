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
`&regions=`, `&nav=`, `&tracks=`, `&tracklist=`, `&highlight=`,
`&sessionTracks=` and `&extendSession=` apply only to this single linear genome
view launch — every other launch type carries the same settings inside the
session it loads. `?config=`, `&sessionName=`, `&hubURL=`, `&renderer=` and
`&session=` work for any launch type.

Two more are documented with the feature they belong to: `&password=` with
[`&session=share-`](#sessionshare-), and `&adminKey=` in
[](/docs/quickstart_adminserver).

### ?config=

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

`&assembly=hg19`

`&assembly=` refers to the `name` field of an entry in the `assemblies` array of
config.json.

### &loc=

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
config's `defaultSession`;
[`&extendSession=true`](#navigating-within-the-default-session) navigates that
session instead of replacing it.

### &regions=

`&assembly=hg38&regions=chr1,chr2,chr3`

Restricts the whole-genome overview to this comma-separated subset of the
assembly's chromosomes, in the order given, handy for dropping unplaced/alt
contigs or reordering. Names resolve through the assembly's aliases. It is
ignored when `&loc=` is set (which navigates to a single region instead), and it
requires `&assembly=`. This is the simple-URL form of the session-spec
[`displayedRegionNames`](#fields-every-view-takes) field, and takes the same
[globs](#glob-region-names).

### &highlight=

`&highlight=chr1:6000-7000`

Creates a highlight over the specified region when combined with
[&assembly=](#assembly) and [&loc=](#loc).

Multiple highlight locations can be specified by delimiting locations with a
space (URL-encoded as `%20`):

`&highlight=chr1:6000-7000%20chr1:7100-7200`

Always pass `&assembly=` alongside `&highlight=`. Highlights are stored by
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

This highlights a _region_, over every track at once, and needs coordinates. To
box a single _feature_ by name, and sort it to the top of its track's layout,
see
[`featureHighlights`](#live-example-highlight-a-feature-and-sort-it-to-the-top).

### &tracklist=

`&tracklist=true`

Opens the track selector on load. Default: false.

### &nav=

`&nav=false`

Turns off the navigation bar of the linear genome view. Default true.

### &tracks=

`&tracks=gene_track,vcf_track`

A comma-separated list of trackIds, which the config.json defines. A trackId
added by `&sessionTracks=` can be named here too.

### &sessionTracks=

`&sessionTracks=` dynamically adds a track to the session. It can also add a
`FromConfigAdapter` track, specifying features inline as JSON — BLAST hits from
the URL bar, say.

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

`&sessionTracks=` works alongside a hub, registering its track configs into the
hub session, so `&tracks=` can name one of them beside the hub's own tracks.

`&hubURL=` opens each hub with a single linear genome view. For anything beyond
that — several views over a hub, a workspace layout, or a dotplot — put the hub
in a session spec's [`sessionConnections`](#session-spec) instead.

See [](/docs/user_guides/hub_url) for the full workflow, including combining a
hub with a config and loading several at once.

### &renderer=

`&renderer=webgl`

Pins the backend tracks are drawn with, rather than detecting one. `webgpu`,
`webgl` and `canvas2d` each pin that one: `webgl` skips WebGPU and uses WebGL2,
`canvas2d` skips both and draws in software, and `webgpu` requires WebGPU.
`canvas` is accepted as an alias for `canvas2d`.

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

`&extendSession=true` alongside `&loc=` navigates a curated `defaultSession`
while keeping its tracks and settings, rather than replacing it:

```
?loc=chr1:100000-200000&extendSession=true
```

`&loc=`, `&tracks=`, `&highlight=`, `&nav=` and `&tracklist=` are then applied
to the **first linear genome view** of that `defaultSession`. The assembly comes
from that view, so `&assembly=` isn't needed. `&sessionTracks=` is not layered
on; a full [session spec](#session-spec) is the way to add a track config to a
curated session.

## Which parameter decides the launch

A link can carry several of these at once, and they don't combine — one of them
decides what opens and the rest are either layered onto it or dropped. The
ranking, highest first:

1. **`&session=`**, in any of its forms (`spec-`, `share-`, `encoded-`, `json-`,
   `local-`). An explicit session always beats a stray `&loc=`. A value matching
   none of those prefixes is an error rather than a fallback.
2. **`&extendSession=true`** alongside `&loc=`/`&assembly=`, which navigates the
   config's `defaultSession` — see
   [below](#navigating-within-the-default-session). It outranks a hub, which
   would otherwise replace that session outright.
3. **`&hubURL=`**, because a hub is the only parameter that brings its own
   assemblies and tracks: a link carrying both a hub and `&loc=` is asking to
   navigate _inside_ the hub, so the shorthand rides along on top of the hub
   session rather than replacing it.
4. **`&loc=`/`&assembly=`** on their own, which build a fresh single linear
   genome view.
5. Nothing of the above, which opens the config's `defaultSession`.

`?config=`, `&sessionName=` and `&renderer=` sit outside the ranking and apply
to whichever launch wins. `&sessionTracks=` applies at ranks 3 and 4 — with a
hub, and with the shorthand on its own. It is not layered onto a default session
or onto a `&session=` of any kind, both of which have their own way to carry a
track (a spec's [`sessionTracks`](#session-spec), the snapshot's own).

## Session spec

A "session spec" encodes a session as JSON in the URL, as the value of
`&session=`, prefixed `spec-`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5100"}]}
```

Each view object lists the keys that view launches with, flat as below. A spec
is arguments to a view's launcher, so nothing is nested. A `defaultSession` in a
config writes the same settings under an `init` block instead, because there the
view is a saved state snapshot (see
[Config / session files](/docs/automating#config--session-files)); moving a view
between the two means reshaping it, and pasting an `init` block into a spec is
reported rather than silently ignored. The embedded
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

### Session-wide fields

Alongside `views`, four top-level arrays furnish the session the views open
into. They are applied in this order — assemblies, then connections, then
tracks, then the views — so each can name what the ones before it registered.

A `sessionTracks` array registers track configs into the session before the
views open, equivalent to combining `&sessionTracks=` with a simple URL:

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

A `sessionAssemblies` array registers assemblies, the counterpart to
`sessionTracks`. Because assemblies are added first, `sessionTracks` and each
view's `assembly` can reference them by name. This makes a spec fully
self-contained: a novel assembly, its tracks, and the views over them, with
nothing baked into the served config (pair it with `?config=none`):

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

A `sessionConnections` array attaches connections — UCSC track hubs, JBrowse
hubs. Each entry is a connection config, and it stays with the session: opening
the link never writes the connection into the config.json the instance serves,
whoever opens it. The spec waits for each connection to finish fetching before
launching its views, so a view can name an assembly or a trackId the connection
supplies:

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
[layout](#tiled-views--workspaces), or a view type other than the linear genome
view — none of which `&hubURL=` can express.

A spec that lists no `views` leaves the connection to open its own view wherever
it starts (a single-file hub's `defaultPos`), which is what `&hubURL=` on its
own does. As soon as the spec has views of its own, that is taken as the launch
instruction and the connection doesn't open a competing one.

A `layout` object tiles the views into a workspace rather than stacking them —
see [tiled views](#tiled-views--workspaces).

[`&sessionName=`](#sessionname) sets a spec's session name, the same as for any
other launch type:

```
&session=spec-{...}&sessionName=My%20Analysis
```

### Fields every view takes

`id` pins the created view's id so another view in the same spec can point at it
(e.g. an MsaView's `connectedViewId`). It is the one key the launcher reserves —
the rest of what every view takes comes from `BaseViewModel` and appears in each
view's table below, `displayName` among them.

`displayedRegionNames` is the spec form of [`&regions=`](#regions), with the
same meaning: when `loc` is omitted it restricts the whole-genome overview to
these chromosomes, in this order. Names may be [globs](#glob-region-names). It
works on the linear genome view, the [circular view](#circular-view), and each
axis of a [dotplot](#dotplot-view) — volvox showing only its two contigs, order
reversed:

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

Globs match the assembly's **aliases** as well as its own names, and match
**case-insensitively**, both the same as an exact entry does — so `["chr*"]`
works on an assembly whose FASTA calls its chromosomes `1`, `2`, `3`, and
`["CHR*"]` works wherever `["chr*"]` does. A region is taken once however many
of its names match.

What a glob will not do is separate the main chromosomes from the rest of a
UCSC-style assembly, because that naming makes the unplaced and alt contigs
extensions of the names you want: on hg38 `chr*` also takes `chrUn_GL000195v1`
and `chr1_KI270706v1_random`, and even `chr1*` takes `chr10` through `chr19`.
There is no negation. Globs are for name families an assembly actually separates
— `*_hap1`, `*_MATERNAL`, `*_alt` — and a main-chromosome subset is still best
written as a list.

The same field, and the same matching, is available on [`&regions=`](#regions),
on the [circular view](#circular-view), on each axis of a
[dotplot](#dotplot-view), and on each row of a
[linear synteny view](#linear-synteny-view).

The dotplot and linear synteny [import forms](#dotplot-view) put this syntax in
a text box — one beside each assembly, holding the comma-separated list this
field takes — so a haplotype-per-axis plot can be reached by clicking rather
than only by writing a spec. Empty means the whole assembly.

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

### Linear genome view

A `LinearGenomeView` object takes two kinds of key, and the launcher sorts them
that way: the launch keys are the [simple params](#linear-genome-view-simple)
plus `grow`, which expands `loc` by that fraction on each side for context (so
`0.2` pads 20%, and it is ignored without a `loc`); everything else is a
property the state model declares.

#### Linear genome view properties

<!-- SPEC_KEYS LinearGenomeView START -->

**Launch keys**, resolved once on attach and then discarded, because they have
no direct representation in the view's state — `assembly`,
`displayedRegionNames`, `grow`, `highlight`, `loc`, `nav`, `tracklist`. There
are no others; a key outside this set and the table below is a typo, and the
launcher names it in a console warning rather than dropping it silently.

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`colorByCDS`](/docs/models/lineargenomeview#property-colorbycds) | color CDS segments by reading frame |
| [`displayedRegions`](/docs/models/lineargenomeview#property-displayedregions) | currently displayed regions, can be a single chromosome, arbitrary subsections, or the entire set of chromosomes in the genome, but it not advised to use the entire set of chromosomes if your assembly is very fragmented |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`hideHeader`](/docs/models/lineargenomeview#property-hideheader) | drop the header bar entirely — location box, navigation buttons and overview |
| [`hideHeaderOverview`](/docs/models/lineargenomeview#property-hideheaderoverview) | keep the header, drop the whole-chromosome overview strip below it |
| [`hideNoTracksActive`](/docs/models/lineargenomeview#property-hidenotracksactive) | suppress the "No tracks active" placeholder, for an embed that opens with no tracks on purpose |
| [`labelsVisible`](/docs/models/lineargenomeview#property-labelsvisible) | controls whether highlight/bookmark chip labels are shown inline |
| [`legacyBpPerPx`](/docs/models/lineargenomeview#property-legacybpperpx) | MIGRATION ONLY, and safe to delete once pre-window sessions are no longer in circulation.<br><br>A snapshot written before the window was stored carries `offsetPx` and `bpPerPx` but not the width they were measured at, so the window they framed cannot be recovered. `windowStartBp` can (it is `offsetPx * bpPerPx`, no width needed); the width in bp cannot. This carries the old `bpPerPx` to the first measure, which adopts it at whatever width arrives — exactly what the old code did — and clears this. So an old link keeps its old behavior rather than being reinterpreted, and everything authored since restores its window. |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`scalebarOnly`](/docs/models/lineargenomeview#property-scalebaronly) | when true, only the header and coordinate scalebar are rendered |
| [`showAminoAcids`](/docs/models/lineargenomeview#property-showaminoacids) | draw translated codons on coding features once zoomed in far enough: an alternating per-codon shading, and the amino acid letters on top of it at base-level zoom. Independent of `colorByCDS`, which only recolors the segments by frame. |
| [`showCenterLine`](/docs/models/lineargenomeview#property-showcenterline) | show the "center line" |
| [`showCytobands`](/docs/models/lineargenomeview#property-showcytobands) | whether to show the "cytobands" in the overview scale bar (the resolved, capability-gated value is the `effectiveShowCytobands` getter) |
| [`showGridlines`](/docs/models/lineargenomeview#property-showgridlines) | show the "gridlines" in the track area |
| [`showHighlightChips`](/docs/models/highlightsmixin#property-showhighlightchips) | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default |
| [`showTrackOutlines`](/docs/models/lineargenomeview#property-showtrackoutlines) | show the track outlines |
| [`trackLabels`](/docs/models/lineargenomeview#property-tracklabels) | how to display the track labels, can be "overlapping", "offset", or "hidden", or empty string "" (which results in the LinearGenomeViewPlugin config default being used). the resolved value is the `effectiveTrackLabels` getter. see LinearGenomeViewPlugin https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is used |
| [`trackSelectorType`](/docs/models/lineargenomeview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |
| [`windowStartBp`](/docs/models/lineargenomeview#property-windowstartbp) | Left edge of the viewport, in linearized bp — the concatenated `displayedRegions` space that `offsetPx` indexes, which carries no inter-region padding, so the two differ only by `bpPerPx`. May be negative, which is the view scrolled past the left end.<br><br>The viewport is stored as the genomic WINDOW it frames rather than as the pixels that framed it, because pixels mean nothing without the width they were measured at and a snapshot does not carry one. Storing them anyway is why a session authored in a 1000px window used to open at 500px showing half the region its author was looking at, while the same location as a `&loc=` opened correctly — the two ways to share a view disagreed, and only the one that stores intent was right. |
| [`windowWidthBp`](/docs/models/lineargenomeview#property-windowwidthbp) | Width of the viewport in bp. Zero means "not established yet": no width has been measured, so there is nothing to divide by. The first measure fills it in, and `bpPerPx` is `windowWidthBp / width` from then on. |

<!-- SPEC_KEYS LinearGenomeView END -->

Three of those warrant more than their one-line description:

- `bpPerPx` and `offsetPx` are the zoom and the horizontal scroll, and `loc` is
  what you want almost always — it reads, and it survives an assembly whose
  regions were rebuilt. Reach for these two only to reproduce a viewport to the
  pixel.
- `displayedRegions` gives the regions the view lays out as full
  `{refName, start, end, assemblyName}` objects. `displayedRegionNames` names
  the same thing by refName and is the shorter form; this is the escape hatch
  for showing part of a chromosome, which a name cannot express.
- `showCytobands` and `showTrackOutlines` default to the visitor's own stored
  preference rather than to a fixed value — both are menu settings persisted in
  `localStorage`, so a spec that omits them opens however that visitor last left
  them. Set them explicitly in a link that has to look the same for everyone.

#### Live example: alignments display settings

`displaySnapshot` is not limited to overriding the display `type`. It can set
any of the display's own settings — anything the display's own menu offers. An
alignments track colored by pair orientation, with soft-clipped bases shown and
an enlarged height:

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

Swapping `showSoftClipping` for `showBezierConnections` draws a curved connector
between the mates of each aberrant pair and across split-read junctions, so
structural-variant signal stands out over the pileup. Each curve is the same
horizontal-tangent shape a breakpoint split view draws:

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

For a feature track (genes, BED, GFF), `color` in the `displaySnapshot` takes a
plain CSS color, or a `jexl:` expression to color per-feature. The genes track
in green:

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

#### Live example: highlight a feature, and sort it to the top

[`&highlight=`](#highlight) paints a band over a _region_, drawn by the view
across every track at once. To box one _feature_ — a gene, transcript or
variant, at whatever row and height its own track laid it out — set
`featureHighlights` on the display. It is the same state the right-click
"Highlight feature" item and a feature search write, and every canvas display
carries it
([`LinearBasicDisplay`](/docs/models/linearbasicdisplay#property-featurehighlights),
`LinearVariantDisplay`, and the rest):

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
            "height": 200,
            "featureHighlights": [{ "refName": "ctgA", "name": "EDEN" }]
          }
        }
      ]
    }
  ]
}
```

A highlight also **sorts its feature to a top row** of that track, ahead of the
row packer's usual order, and holds it there across pan and zoom. On a dense
annotation track that is most of the point — the named gene is boxed _and_ is
the first thing in the lane, rather than boxed seven rows down. Only a
declarative highlight moves anything: the right-click one marks a feature the
user just clicked, and yanking that out of its row would be the opposite of
helpful.

Each entry names one feature, either way:

- **By name** — `{"refName": "ctgA", "name": "EDEN"}`. The feature's label,
  matched exactly and case-insensitively within that refName. Prefer this.
- **By span** — `{"refName": "ctgA", "start": 1049, "end": 9000}`, in interbase
  (0-based half-open) coordinates, matched within ±1bp of the track's own
  record.

The trap in the span form is that a location box reads `ctgA:1,050-9,000` for
that same feature — 1-based and inclusive — so coordinates copied off the screen
are a base short at the start and match nothing. An entry may carry both, in
which case `name` is the fallback used when the span misses. A name that is
genuinely ambiguous (a gene and its same-named transcript) boxes both.

A span that resolves to nothing logs a console warning naming the coordinates,
once data covering it has loaded. A name that resolves to nothing stays silent —
it is indistinguishable from a feature elsewhere on the contig that has not been
fetched yet. To clear, use the clear-highlights button that appears in the view
header while anything is highlighted, or the track menu's "Clear N highlights".

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

#### Circular view properties

As with the linear genome view, the spec also takes the view's own declared
properties:

<!-- SPEC_KEYS CircularView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `assembly` | the assembly whose chromosomes the circle draws. Optional because a spec view is untyped user input; without one the view opens on its import form |
| `displayedRegionNames` | whole chromosomes to draw, in this order; the rest of the assembly's contigs are left off the circle |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`autoFit`](/docs/models/circularview#property-autofit) | whether the view keeps re-fitting to its container on resize. Cleared once the user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is preserved across resizes and reloads. |
| [`bpPerPx`](/docs/models/circularview#property-bpperpx) | the zoom level, base-pairs per pixel. Capped by `minimumRadiusPx`, and refit over by the first resize unless `autoFit` is false. |
| [`disableImportForm`](/docs/models/circularview#property-disableimportform) | suppress the import form even on an error — what the SV inspector's circle wants, since its assembly comes from the sheet beside it and a form there would offer a control that cannot work |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`height`](/docs/models/circularview#property-height) | the height of the view in pixels. The circle auto-fits its container, so this is what sizes the drawing. |
| [`hideTrackSelectorButton`](/docs/models/circularview#property-hidetrackselectorbutton) | chrome switch, for an embed that drives the view itself |
| [`hideVerticalResizeHandle`](/docs/models/circularview#property-hideverticalresizehandle) | chrome switch, for an embed that drives the view itself |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`minimumRadiusPx`](/docs/models/circularview#property-minimumradiuspx) | how far in the circle may be zoomed, as a floor on the radius; it is what caps bpPerPx |
| [`minVisibleWidth`](/docs/models/circularview#property-minvisiblewidth) | arcs thinner than this many pixels are elided instead of drawn, which is what stops a few thousand unplaced contigs becoming a ring of hairlines |
| [`offsetRadians`](/docs/models/circularview#property-offsetradians) | similar to offsetPx in linear genome view |
| [`paddingPx`](/docs/models/circularview#property-paddingpx) | blank margin between the circle and the edge of the figure |
| [`spacingPx`](/docs/models/circularview#property-spacingpx) | the gap drawn between adjacent chromosome arcs |
| [`trackSelectorType`](/docs/models/circularview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |

<!-- SPEC_KEYS CircularView END -->

`bpPerPx` and `offsetRadians` are the circle's zoom and rotation, the
equivalents of the linear view's `bpPerPx`/`offsetPx`; pairing them with
`autoFit: false` is what stops the first resize refitting over them.

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

#### Dotplot view properties

The dotplot spec accepts extra top-level fields applied on load:

<!-- SPEC_KEYS DotplotView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `autoDiagonalize` | After tracks load, automatically run the chromosome diagonalization pass so the bottom/vertical axis follows the top/horizontal axis. The canvas is hidden behind a "Reordering chromosomes…" spinner during the wait, so the user doesn't see an undiagonalized flash. |
| `colorBy` | Initial colorBy. Use 'query' (chromosome painting) for whole-genome views where the default red is hard to distinguish across many ribbons. One of `default`, `strand`, `query`, `target`, `reference`, `identity`, `meanQueryIdentity`, `mappingQuality`, `dnds`, `track`. |
| `highlight` | loc-strings ("chr1:100-200") or JSON objects matching HighlightType, mirroring LinearGenomeView's init.highlight |
| `minAlignmentLength` | Per-feature alignment-length filter applied at the renderer. Hides chains shorter than this many bp; cuts the genome-scale hairball. |
| `showColorLegend` | Show the floating color-by legend on load. Set false to hide it (e.g. a curated demo/screenshot where the legend would clutter the figure). |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`alpha`](/docs/models/dotplotview#property-alpha) | Plot-wide alpha applied to every point. View-level for the same reason lineWidth is: the only control is view-level, so storing it per display meant a track shown after the slider moved rendered at the default while the slider said otherwise. |
| [`assemblyNames`](/docs/models/dotplotview#property-assemblynames) | the two assemblies being compared, horizontal axis first. A spec normally names these per axis instead, as `views[0].assembly` and `views[1].assembly`. |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`drawCigar`](/docs/models/dotplotview#property-drawcigar) | resolve each alignment's CIGAR into the drawn shape rather than plotting it as a single straight segment |
| [`height`](/docs/models/dotplotview#property-height) | the height of the plot in pixels |
| [`hview`](/docs/models/dotplotview#property-hview) | the horizontal axis, as a full 1D view state. A spec writes `views[0]` instead, which the launcher resolves into this. |
| [`lineWidth`](/docs/models/dotplotview#property-linewidth) | Screen-space line width (CSS pixels) applied to every dotplot display in this view. View-level because the GPU pass renders all displays with one uniform. |
| [`lockAspectRatio`](/docs/models/dotplotview#property-lockaspectratio) | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square. Wheel zoom already preserves the ratio; box-zoom and other independent ops trigger an autorun resync. |
| [`lodMode`](/docs/models/dotplotview#property-lodmode) | Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all displays render at the same tier and the menu doesn't need to fan out per display. |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`showGridlines`](/docs/models/dotplotview#property-showgridlines) | carry each axis' ruler ticks across the plot as faint lines, the way LinearGenomeView's gridlines carry its own down over the tracks |
| [`showHighlightChips`](/docs/models/highlightsmixin#property-showhighlightchips) | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default |
| [`trackColorBy`](/docs/models/trackcolorsmixin#property-trackcolorby) | trackId -> color-by mode for that track alone. Absent means the track follows the view-wide `colorBy`. |
| [`trackColors`](/docs/models/trackcolorsmixin#property-trackcolors) | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. |
| [`trackSelectorType`](/docs/models/dotplotview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |
| [`viewTrackConfigs`](/docs/models/dotplotview#property-viewtrackconfigs) | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere |
| [`vview`](/docs/models/dotplotview#property-vview) | the vertical axis, the counterpart to `hview`. A spec writes `views[1]`. |

<!-- SPEC_KEYS DotplotView END -->

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

Each entry in `views` is one genome row, and takes the same keys an
[LGV](#linear-genome-view) does. `displayedRegionNames` restricts that row to a
subset of its assembly, with [globs](#glob-region-names) allowed — so a
whole-genome synteny view can put one haplotype on each row (`["*_MATERNAL"]`
above `["*_PATERNAL"]`) instead of stacking both interleaved. Use it instead of
`loc`, not alongside: `loc` navigates within what a row displays, and takes
precedence.

#### Linear synteny view properties

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

<!-- SPEC_KEYS LinearSyntenyView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `autoDiagonalize` | After tracks load, automatically run the chromosome diagonalization pass so the bottom/vertical axis follows the top/horizontal axis. The canvas is hidden behind a "Reordering chromosomes…" spinner during the wait, so the user doesn't see an undiagonalized flash. |
| `collapseEmptyRows` | Open any genome row this init gives no tracks collapsed to its ruler. The "No tracks active / Open track selector" block costs ~90px per row, which on a five-row launch is more of the viewport than the ribbons; a row is one click from expanding again (MiniControls, or the view menu's "Genome views" → "Expand all views"). Off by default so an authored session keeps its rows as written — the launch dialog turns it on, and offers a checkbox to not. |
| `colorBy` | Initial colorBy. Use 'query' (chromosome painting) for whole-genome views where the default red is hard to distinguish across many ribbons. One of `default`, `strand`, `query`, `target`, `reference`, `identity`, `meanQueryIdentity`, `mappingQuality`, `dnds`, `track`. |
| `levelHeights` | Pixel height of each synteny strip, one entry per level. Useful for whole-genome views where the default ~100px is too cramped for the ribbon detail to be readable. |
| `minAlignmentLength` | Per-feature alignment-length filter applied at the renderer. Hides chains shorter than this many bp; cuts the genome-scale hairball. |
| `sameScale` | Put every genome row on one bp/px, the coarsest row's, instead of fitting each to the pane width. The largest genome then fills the frame and the rest are drawn shorter in proportion, so a size difference between rows (polyploidy, a genome duplication) is visible as length rather than hidden by the per-row stretch — and orthologs between two rows line up at the same scale on both. Applied last, after any autoDiagonalize pass. |
| `showColorLegend` | Show the floating color-by legend on load. Set false to hide it (e.g. a curated demo/screenshot where the legend would clutter the figure). |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`alpha`](/docs/models/linearsyntenyview#property-alpha) | Per-feature opacity in [0,1]. The default is tuned for dense unfiltered hairballs; a whole-genome view with minAlignmentLength set can use a higher value (~0.4) for stronger color. |
| [`bidirectionalFetch`](/docs/models/linearsyntenyview#property-bidirectionalfetch) | Ask each level's adapter for the alignments anchored on its LOWER row as well as its upper one.<br><br>A synteny band queries its query axis — the upper row of the pair — so an alignment anchored on a lower-row contig whose other end is somewhere the upper row is not showing is never requested, and nothing downstream can recover it. Which genome a user stacked on top therefore decided what the view was able to report.<br><br>A FETCH INPUT, unlike `showOffscreenMates` above, and off by default because it is a second query per level. |
| [`cigarMode`](/docs/models/linearsyntenyview#property-cigarmode) | How per-base insertions and deletions inside each alignment are shown: 'full' paints indel wedges, 'matches' leaves them see-through, 'off' draws blocks only. |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`drawCurves`](/docs/models/linearsyntenyview#property-drawcurves) | Render ribbons as bezier curves rather than straight chords. Reads much better at whole-genome scale, where straight crossings stack into noise. |
| [`drawLocationMarkers`](/docs/models/linearsyntenyview#property-drawlocationmarkers) | Continue the query view's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. |
| [`fadeThinAlignmentsMode`](/docs/models/linearsyntenyview#property-fadethinalignmentsmode) | Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. 'auto' enables the fade once a display is dominated by sub-pixel ribbons (see `thinnestMeanAlignmentPx`); a genuinely sparse comparison (only a handful of ribbons) keeps full alpha so the fade doesn't wash it out. 'on'/'off' pin it. Resolved view-wide by the `fadeThinAlignments` getter, so all levels fade together. |
| [`followAnchorIndex`](/docs/models/linearcomparativeview#property-followanchorindex) | Which genome row drives the others while `followSynteny` is on. Every other row is placed by mapping this one's window outward one level at a time. Clamped to the views array by reconcileLevels. |
| [`followSynteny`](/docs/models/linearcomparativeview#property-followsynteny) | Move the non-anchor genome rows to whatever region aligns to the anchor row, re-resolved through the synteny data each time the anchor settles. The synteny-aware alternative to `linkViews`, which locks the rows in PIXELS and so drifts apart as soon as an indel accumulates — the two are mutually exclusive (see setRowSyncMode). |
| [`levels`](/docs/models/linearcomparativeview#property-levels) | One synteny band per adjacent pair of `views`. Each holds its own track list, which is why the track-selector and add-track widgets address them through `trackContainerFor` — a level is not a view and cannot be the target of their `view` reference. |
| [`linkViews`](/docs/models/linearcomparativeview#property-linkviews) | sync scroll and zoom across the genome rows, so panning one pans them all |
| [`lodMode`](/docs/models/linearsyntenyview#property-lodmode) | Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces the no-CIGAR tier (T/Q) when present. |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`opacityByIdentity`](/docs/models/linearsyntenyview#property-opacitybyidentity) | Fade alignment blocks by per-feature identity (lower identity = more transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without consuming the color channel. |
| [`overdrawPx`](/docs/models/linearsyntenyview#property-overdrawpx) | pixels beyond the visible viewport edge that synteny lines are still drawn. Effective up to the pan buffer (`syntenyPanBufferPx`: 2000px, or half the viewport when that is wider) — the worker emits CIGAR detail and location markers only that far, so a larger value draws ribbons whose detail stops partway along them. |
| [`showOffscreenMates`](/docs/models/linearsyntenyview#property-showoffscreenmates) | Mark, on the query axis, the alignments whose mate is on a contig the facing row is not displaying — real synteny a ribbon has nowhere to land, which the view otherwise draws nothing for. |
| [`trackColorBy`](/docs/models/trackcolorsmixin#property-trackcolorby) | trackId -> color-by mode for that track alone. Absent means the track follows the view-wide `colorBy`. |
| [`trackColors`](/docs/models/trackcolorsmixin#property-trackcolors) | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. |
| [`trackSelectorType`](/docs/models/linearcomparativeview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |
| [`viewTrackConfigs`](/docs/models/linearcomparativeview#property-viewtrackconfigs) | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere |

<!-- SPEC_KEYS LinearSyntenyView END -->

Two of those are accepted because the view declares them and are almost never
what an author wants to write: filling `levels` is what `tracks` does — one
entry per level — and sizing them is `levelHeights`, so reach for `levels` only
to author a band's full state; and `viewTrackConfigs` exists for the
read-vs-reference dotplot, whose track would mean nothing anywhere else.

Each entry in `views` is a linear genome view, so besides `loc`, `assembly` and
`tracks` it takes that view's own launch props (`trackLabels`, `colorByCDS`,
`showAminoAcids`, `showCenterLine`, `showHighlightChips`), and its `tracks`
entries take inline display options the same way the
[LGV's do](#advanced-track-configuration) — a shorter `LGVSyntenyDisplay`
height, say.

#### Linear synteny view (multi-way)

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

<!-- SPEC_KEYS BreakpointSplitView START -->

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`height`](/docs/models/breakpointsplitview#property-height) | the height of the whole view in pixels, panels and overlay together |
| [`interactiveOverlay`](/docs/models/breakpointsplitview#property-interactiveoverlay) | make the alignment squiggles drawn between the panels clickable, rather than a static overlay |
| [`linkViews`](/docs/models/breakpointsplitview#property-linkviews) | sync scroll and zoom across the panels, so panning one pans them all |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`showHeader`](/docs/models/breakpointsplitview#property-showheader) | show the view's own header bar, above the panels' own |
| [`showIntraviewLinks`](/docs/models/breakpointsplitview#property-showintraviewlinks) | draw the links whose two ends land in the same panel, as well as the ones that cross between panels |

<!-- SPEC_KEYS BreakpointSplitView END -->

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

<!-- SPEC_KEYS SpreadsheetView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `assembly` | the assembly the sheet's rows are read against. With only this and no `uri`, the view opens on its import form with that assembly already selected rather than the first one in the config |
| `fileType` | the file's format. Otherwise detected from the extension, falling back to VCF, so name it for a file the extension does not identify |
| `filterText` | search-box text, applied once the file is loaded |
| `uri` | the file to load into the sheet. A spec view is untyped user input, so this can be absent, and the view then opens on the import form |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`height`](/docs/models/spreadsheetview#property-height) | the height of the sheet in pixels |
| [`hideVerticalResizeHandle`](/docs/models/spreadsheetview#property-hideverticalresizehandle) | chrome switch, for an embed that sizes the view itself |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |

<!-- SPEC_KEYS SpreadsheetView END -->

`fileType` is one of `VCF`, `BED`, `BEDPE` or `STAR-Fusion` — a URL with no
extension needs it, and so does `STAR-Fusion` output, which has none of its own.

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

The circular half draws the rows the spreadsheet half's filter leaves, so
`filterText` is what makes a chord subset reachable from a link.

<!-- SPEC_KEYS SvInspectorView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `assembly` | the assembly both halves are read against. With only this and no `uri`, the view opens on its import form with that assembly already selected rather than the first one in the config |
| `fileType` | the file's format. Otherwise detected from the extension, falling back to VCF, so name it for a file the extension does not identify |
| `filterText` | search-box text for the spreadsheet half, applied once the file is loaded. The circular half draws the rows it leaves, so this is what makes a chord subset reachable from a link |
| `uri` | the file to load. A spec view is untyped user input, so this can be absent, and the view then opens on the import form |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`height`](/docs/models/svinspectorview#property-height) | the height of the whole view in pixels, sheet and circle together |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`onlyDisplayRelevantRegionsInCircularView`](/docs/models/svinspectorview#property-onlydisplayrelevantregionsincircularview) | restrict the circular half to the chromosomes the loaded rows actually touch, instead of drawing an arc for every one in the assembly |
| [`spreadsheetWidthFraction`](/docs/models/svinspectorview#property-spreadsheetwidthfraction) | share of the view's width given to the spreadsheet, the rest goes to the circular view. Persisted so dragging the divider survives both a window resize and a session reload |

<!-- SPEC_KEYS SvInspectorView END -->

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
  See also the [proteins tutorial](/docs/tutorials/genomes_proteins).
- `MsaView` (multiple sequence alignments) from `jbrowse-plugin-msaview`. Fields
  such as `msaFileLocation`, `treeFileLocation`, and `connectedViewId` are
  documented in the plugin's
  [DEVELOPERS.md](https://github.com/GMOD/jbrowse-plugin-msaview/blob/main/DEVELOPERS.md).

### Tiled views / Workspaces

A spec's `layout` arranges its views into a tiled workspace, and turns
workspaces mode on by doing so. It is a tree whose every node is one of two
things:

- a **panel**, carrying a `views` array of indices into the spec's own `views`,
  displayed stacked vertically
- a **container**, carrying a `children` array, whose `direction` arranges them
  `"horizontal"` (left-right), `"vertical"` (top-bottom) or `"tabs"` (one tab
  group, one child visible at a time)

Containers nest arbitrarily deep.

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

Views 0 and 1 stack in the left panel, view 2 sits alone on the right.

#### Custom panel sizes

A panel's `size` gives its proportion of the split:

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

A 70/30 split, the left panel taking 70% of the width.

`size` works at **any depth**, so a nested container sizes its own children as
well as taking a share of its parent — see the nested example below. A panel
left unsized takes an equal share of whatever the sized panels leave over, so
`70` beside a bare panel is a 70/30 split. Sizes are proportions rather than
strict percentages: `7` and `3` lay out the same as `70` and `30`.

Drag the divider to adjust from there; the position is saved with the session.

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

A `tabs` node is the one container that does not divide space, so it is also the
one place a statement can go unhonoured: a `size` on its children describes
nothing, and a container nested inside it has no split to become — its views are
gathered into a single tab instead. A spec that does either says so in a
notification when it loads. Everywhere else, `size` and nesting mean what they
say.

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

Containers nested inside containers:

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
        "views": [0, 1],
        "size": 60
      },
      {
        "direction": "vertical",
        "size": 40,
        "children": [
          {
            "views": [2],
            "size": 75
          },
          {
            "views": [3],
            "size": 25
          }
        ]
      }
    ]
  }
}
```

Views 0 and 1 stack in the left panel, which takes 60% of the width; the right
40% splits vertically, view 2 taking three quarters of that column and view 3
the rest. The `75`/`25` is the nested sizing — it divides the right-hand
container's own height, not the window's.

## Other session formats

Besides `spec-`, `&session=` takes four formats that each carry a session
snapshot rather than instructions for building one.

### &session=json-

Like encoded sessions but more readable, `&session=json-` takes a plain JSON
snapshot of a session. Unlike a session spec (which runs extra logic to build
the session), a JSON session is a literal snapshot, the same shape produced by
"Export session...".

The Share button's gear icon offers this as "Plaintext JSON": the longest of the
three formats, and the one to pick when you want to read what the session
actually contains.

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"name":"MsaView","url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

The `sessionPlugins` array in there loads an extra plugin with the session — see
[below](#loading-a-plugin-from-a-url).

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

### Loading a plugin from a URL

A snapshot's `sessionPlugins` array is the only way to name a plugin in the URL
itself: no query parameter takes one, and a [session spec](#session-spec) has no
field for it, so anything else has to come from the config JBrowse loads. It
takes the same definitions a config's `plugins` array takes, and works in all
four formats above — `json-`, `encoded-`, `share-` and `local-`. A plugin loaded
this way belongs to that session rather than being installed for the user, and
travels with it through the Share button.

Four things govern one written by hand:

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

## See also

- [](/docs/config_and_session_json)
- [](/docs/automating)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/config_guides/default_session)
- [](/docs/developer_guides/extension_points)
