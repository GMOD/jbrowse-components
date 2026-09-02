---
title: URL query parameter API
sidebar_label: URL parameters
description:
  Drive JBrowse Web from the URL with loc, assembly, tracks, and the session
  spec that launches any view type
---

JBrowse Web reads its launch state from the URL. Embedded components such as
`@jbrowse/react-linear-genome-view2` leave URL handling to the host app.

## Query string or hash fragment

- Every parameter works in either place: `?config=…&loc=…` or `#config=…&loc=…`.
- A fragment is never sent to the server, so a long value (an `encoded-` or
  `json-` session, a whole [session spec](#session-spec), a big
  `&sessionTracks=`) cannot trip the request-line limit that answers a long
  query string with HTTP 414. The Share button writes its inline formats as hash
  URLs for that reason.
- If the fragment contains an `=`, JBrowse reads its parameters only from there
  and ignores the query string. Moving one long parameter into the fragment
  means moving them all: `?config=my.json#session=spec-{…}` loads the default
  `config.json`, not `my.json`.

## Linear genome view (simple)

One linear genome view, from a handful of parameters:

`http://host/jbrowse2/?config=test_data/config.json&loc=chr1:6000-7000&assembly=hg19&tracks=gene_track,vcf_track`

- `&assembly=`, `&loc=`, `&regions=`, `&nav=`, `&tracks=`, `&tracklist=`,
  `&highlight=`, `&sessionTracks=` and `&extendSession=` apply only to this
  launch. Every other launch type carries the same settings inside the session
  it loads.
- `?config=`, `&sessionName=`, `&hubURL=`, `&renderer=` and `&session=` work for
  any launch type.
- `&password=` belongs to [`&session=share-`](#sessionshare-), and `&adminKey=`
  to [](/docs/quickstart_adminserver).

### ?config=

`?config=test_data/volvox/config.json`

- A path to a config file, relative to the current folder, fetched by the
  client. Omitted, JBrowse loads `config.json` from the current folder, which is
  what `@jbrowse/cli` sets up.
- `?config=none` skips the config entirely, for a `&hubURL=` that supplies its
  own assemblies and tracks.
- To change the default without putting `?config=` in every link, set
  `window.__jbrowseConfigPath` in the `<head>` of `index.html`
  ([](/docs/config_guides/avoiding_stale_config)). An explicit `?config=` still
  wins.

### &assembly=

`&assembly=hg19`, the `name` of an entry in the config's `assemblies` array.

### &loc=

`&loc=chr1:6000-7000`, navigated to on load. Accepted forms:

```
&loc=chr1:6000-7000 // using - notation for range
&loc=chr1:6000..7000 // using .. notation for range
&loc=chr1:7000 // centered on this position
&loc=chr1 // the whole of one chromosome
&loc=chr1%206000%207000 // refName, start and end, whitespace separated
&loc=chr1:34M-35M // coordinates abbreviated with a unit suffix
&loc=GENEID // if you have used `jbrowse text-index`
```

- A coordinate takes a `k`, `M` or `G` suffix, optionally followed by `b` or
  `bp`, and is expanded to whole base pairs on load.
- A gene name needs a text index built with `jbrowse text-index`.
- Several whitespace-separated locstrings (`%20` in a URL) open a discontinuous
  view showing each region in turn: a gene and its fusion partner, an allele
  beside the sequences it derives from. The location box displays the same form
  once a view holds more than one region, so what you copy out of it pastes back
  into a URL.
- `&loc=` and `&assembly=` start a fresh session, ignoring the config's
  `defaultSession`;
  [`&extendSession=true`](#navigating-within-the-default-session) navigates that
  session instead.

### &regions=

`&assembly=hg38&regions=chr1,chr2,chr3`

Restricts the whole-genome overview to this subset of the assembly's
chromosomes, in this order, for dropping unplaced contigs or reordering. Names
resolve through the assembly's aliases and take [globs](#glob-region-names). It
requires `&assembly=`, is ignored when `&loc=` is set, and is the simple-URL
form of the spec's [`displayedRegionNames`](#fields-every-view-takes).

### &highlight=

`&highlight=chr1:6000-7000`, a band over the region on every track, with
[&assembly=](#assembly) and [&loc=](#loc).

- Several regions are space-separated (`%20`).
- Always pass `&assembly=`. Highlights are stored by assembly name so the chip
  menu's actions can resolve them; the same applies to `view.highlight` in a
  session JSON, where each entry takes `assemblyName`.
- A URL-encoded JSON object in place of a locstring adds `color` (used as-is,
  alpha included) and `label` (shown beside the chip icon):
  `&highlight={"refName":"11","start":32200274,"end":32203877,"color":"rgba(240,128,128,0.3)","label":"R2_intron"}`.
  Locstrings and JSON objects can be mixed in one value.
- To box one feature by name and sort it to the top of its track, see
  [`featureHighlights`](#live-example-highlight-a-feature-and-sort-it-to-the-top).

### &tracklist=

`&tracklist=true` opens the track selector on load. Default false.

### &nav=

`&nav=false` hides the linear genome view's navigation bar. Default true.

### &tracks=

`&tracks=gene_track,vcf_track`, a comma-separated list of trackIds from the
config. A trackId added by `&sessionTracks=` can be named here too.

### &sessionTracks=

Adds track configs to the session from the URL. A track over a data file needs
no `type` or `adapter`, since the extension gives both, but nothing implies its
assembly, so name it
([the shortest track](/docs/config_guides/tracks#the-shortest-track)):

```
&sessionTracks=[{"trackId":"reads","uri":"https://example.com/sample.bam","assemblyNames":["hg38"]}]
```

A track with no data file, such as BLAST hits carried inline as a
`FromConfigAdapter`, takes the full form.
[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL%20track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]),
whose value pretty-printed is:

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

`&sessionName=My%20Custom%20Session` names the session in the header bar, for
any launch type. Without it the name is generated with a timestamp.

### &hubURL=

`&hubURL=https://example.com/hub.txt&config=none`

- Loads one or more UCSC track hubs (comma-separated) as a session, usually with
  `?config=none` since the hub supplies its own assemblies and tracks.
- `&assembly=` and `&loc=` open the hub at a place; `&assembly=` is required,
  since it names the hub genome `&loc=` resolves against:
  `?config=none&hubURL=https://example.com/hub.txt&assembly=GCF_019202715.1&loc=chr1:1-100000`.
- `&sessionTracks=` registers into the hub session, so `&tracks=` can name one
  of them beside the hub's own.
- Each hub opens with a single linear genome view. For several views, a
  workspace layout or a dotplot, put the hub in a session spec's
  [`sessionConnections`](#session-spec).
- [](/docs/user_guides/hub_url) is the full workflow.

### &renderer=

`&renderer=webgl` pins the drawing backend, overriding detection: `webgpu`,
`webgl`, or `canvas2d` (alias `canvas`). A pin never falls through, so a backend
that cannot start shows an error on every track. It is a debugging aid
([my tracks are blank](/docs/troubleshooting#my-tracks-are-blank-or-render-incorrectly)),
and JBrowse Desktop takes the same choice as
[`--renderer`](/docs/quickstart_desktop#launching-from-the-command-line).

### &safeMode

`&safeMode`, bare, loads without the plugins this browser
[keeps for this configuration](/docs/user_guides/plugin_store#keeping-a-plugin-for-every-visit),
for one load only. Its use is a plugin that crashes the app before any menu is
on screen; the fatal error dialog offers the same thing as a button.

### Navigating within the default session

`&extendSession=true` beside `&loc=` navigates a curated `defaultSession`
instead of replacing it:

```
?loc=chr1:100000-200000&extendSession=true
```

`&loc=`, `&tracks=`, `&highlight=`, `&nav=` and `&tracklist=` then apply to the
first linear genome view of that session, whose assembly is used, so
`&assembly=` is not needed. `&sessionTracks=` is not layered on; a
[session spec](#session-spec) is the way to add a track config to a curated
session.

## Which parameter decides the launch

A link can carry several of these at once, and they do not combine: one decides
what opens and the rest are layered onto it or dropped. Highest first:

- **`&session=`**, in any form (`spec-`, `share-`, `encoded-`, `json-`,
  `local-`). A value matching none of those prefixes is an error.
- **`&extendSession=true`** beside `&loc=`/`&assembly=`, which navigates the
  config's `defaultSession`. It outranks a hub, which would otherwise replace
  that session.
- **`&hubURL=`**. A link carrying both a hub and `&loc=` navigates inside the
  hub.
- **`&loc=`/`&assembly=`** on their own, a fresh single linear genome view.
- **Nothing of the above** opens the config's `defaultSession`.

`?config=`, `&sessionName=` and `&renderer=` sit outside the ranking and apply
to whichever launch wins. `&sessionTracks=` applies to the hub launch and to the
shorthand on its own, and is not layered onto a default session or any
`&session=`, which carry tracks their own way.

## Session spec

A session spec is the session as JSON in the URL, the value of `&session=`
prefixed `spec-`:

```
&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5100"}]}
```

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

- Each view object lists the keys it launches with, written directly on the
  view. A `defaultSession` in a config carries the same object
  ([](/docs/automating#where-the-view-object-goes)), so a view moves between a
  spec, a config and an `addView` call unchanged.
- `views` takes several views, opened together. `loc` is optional; omitting it
  shows the whole genome. Other view types take other keys: a dotplot takes two
  assemblies.
- Each view's `type` dispatches to a `LaunchView-<type>`
  [extension point](/docs/developer_guides/extension_points), which is how
  [plugins](#plugin-provided-view-types) add launchable view types.

### Session-wide fields

Four top-level arrays furnish the session the views open into, applied in this
order so each can name what the ones before it registered:

- `sessionAssemblies` registers assemblies. With `?config=none` a spec is then
  fully self-contained: a novel assembly, its tracks, and the views over them.
- `sessionConnections` attaches connections, UCSC track hubs or JBrowse hubs,
  and waits for each to finish fetching before launching the views, so a view
  can name an assembly or trackId the connection supplies. A spec with no
  `views` leaves the connection to open its own view where it starts, which is
  what [`&hubURL=`](#huburl) does.
- `sessionTracks` registers track configs, the spec form of `&sessionTracks=`.
- `views`, then a `layout` that tiles them into a
  [workspace](#tiled-views--workspaces).

Everything a session carries this way stays with the session: opening the link
never writes into the `config.json` the instance serves.

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

[`&sessionName=`](#sessionname) names a spec's session the same as any other
launch.

### Fields every view takes

- `id` pins the created view's id so another view in the same spec can point at
  it (an MsaView's `connectedViewId`). It is the one key the launcher reserves;
  the rest of what every view takes comes from `BaseViewModel` and appears in
  each view's table below, `displayName` among them.
- `displayedRegionNames` is the spec form of [`&regions=`](#regions): with no
  `loc`, it restricts the whole-genome overview to these chromosomes, in this
  order. It works on the linear genome view, the
  [circular view](#circular-view), each axis of a [dotplot](#dotplot-view) and
  each row of a [synteny view](#linear-synteny-view). Volvox showing its two
  contigs, order reversed:

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

An entry containing `*` is a glob matched against the refName, so `["*_hap1"]`
covers sixteen scaffolds in one entry and survives the assembly being rebuilt.

- `*` is the only metacharacter; regex punctuation in a refName (`chr1.1`,
  `scaffold[2]`) matches literally.
- A glob contributes its matches in the assembly's order; exact names contribute
  in the order written, and entries already taken are skipped, so
  `["chr1_hap1", "*_hap1"]` reads as "chr1 first, then the rest of hap1".
- Globs match aliases and match case-insensitively, the same as an exact entry.
  A name matching nothing is dropped, and a list matching nothing at all is
  reported.
- There is no negation, and on a UCSC-style assembly `chr*` also takes
  `chrUn_GL000195v1` and `chr1_KI270706v1_random`, while `chr1*` takes `chr10`
  through `chr19`. Globs suit name families an assembly separates (`*_hap1`,
  `*_MATERNAL`, `*_alt`); a main-chromosome subset is best written as a list.
- The dotplot and synteny import forms put the same syntax in a text box beside
  each assembly.

#### Advanced track configuration

A `tracks` entry is a trackId string, or an object carrying initial display
state:

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

- `displaySnapshot` takes anything the display's own menu offers: `type` to pick
  a display, `height`, `color` (a CSS color or a `jexl:` expression), `minScore`
  and `maxScore` on a quantitative track, `forceLoad` to render past the "too
  much data" gate ([](/docs/config/baselineardisplay/#slot-forceload)).
- `trackSnapshot` sets track state such as `pinned: true`.
- Any other key on the object is a display setting, so
  `{ "trackId": "my_bam_track", "type": "LinearAlignmentsDisplay", "height": 300 }`
  is the shorthand for the nested form. Use the explicit form when you also pass
  `trackSnapshot`.

### Linear genome view

A `LinearGenomeView` object takes the
[simple params](#linear-genome-view-simple) plus `grow`, which pads `loc` by
that fraction on each side (`0.2` pads 20%), and beyond those any property the
state model declares.

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
| [`showHighlightChips`](/docs/models/highlightsmixin#property-showhighlightchips) | pins the interactive highlight chip (link icon + context menu) to every highlight band; off by default, where a band instead reveals its chip while the pointer is in it. This is what a screenshot needs, since nothing hovers in one |
| [`showTrackOutlines`](/docs/models/lineargenomeview#property-showtrackoutlines) | show the track outlines |
| [`trackLabels`](/docs/models/lineargenomeview#property-tracklabels) | how to display the track labels, can be "overlapping", "offset", or "hidden", or empty string "" (which results in the LinearGenomeViewPlugin config default being used). the resolved value is the `effectiveTrackLabels` getter. see LinearGenomeViewPlugin https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is used |
| [`trackSelectorType`](/docs/models/lineargenomeview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |
| [`windowStartBp`](/docs/models/lineargenomeview#property-windowstartbp) | Left edge of the viewport, in linearized bp — the concatenated `displayedRegions` space that `offsetPx` indexes, which carries no inter-region padding, so the two differ only by `bpPerPx`. May be negative, which is the view scrolled past the left end.<br><br>The viewport is stored as the genomic WINDOW it frames rather than as the pixels that framed it, because pixels mean nothing without the width they were measured at and a snapshot does not carry one. Storing them anyway is why a session authored in a 1000px window used to open at 500px showing half the region its author was looking at, while the same location as a `&loc=` opened correctly — the two ways to share a view disagreed, and only the one that stores intent was right. |
| [`windowWidthBp`](/docs/models/lineargenomeview#property-windowwidthbp) | Width of the viewport in bp. Zero means "not established yet": no width has been measured, so there is nothing to divide by. The first measure fills it in, and `bpPerPx` is `windowWidthBp / width` from then on. |

<!-- SPEC_KEYS LinearGenomeView END -->

- `bpPerPx` and `offsetPx` are the zoom and the horizontal scroll. `loc` reads
  better and survives an assembly whose regions were rebuilt; reach for these
  two only to reproduce a viewport to the pixel.
- `displayedRegions` gives the regions the view lays out as full
  `{refName, start, end, assemblyName}` objects, which is the form for showing
  part of a chromosome; `displayedRegionNames` names whole ones.
- `showCytobands` and `showTrackOutlines` default to the visitor's own stored
  preference, so set them explicitly in a link that has to look the same for
  everyone.

#### Live example: alignments display settings

An alignments track colored by pair orientation, with soft-clipped bases shown
and an enlarged height. Swapping `showSoftClipping` for `showBezierConnections`
draws a curved connector between the mates of each aberrant pair and across
split-read junctions:

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

#### Live example: feature track color

`color` on a feature track's display takes a CSS color, or a `jexl:` expression
such as `"jexl:get(feature,'type')=='gene'?'blue':'gray'"` to color per feature:

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

#### Live example: highlight a feature, and sort it to the top

[`&highlight=`](#highlight) paints a band over a region across every track. To
box one feature at whatever row its own track laid it out, set
`featureHighlights` on the display, the same state the right-click "Highlight
feature" item and a feature search write
([`LinearBasicDisplay`](/docs/models/linearbasicdisplay#property-featurehighlights),
`LinearVariantDisplay`, and every other canvas display):

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

- A declarative highlight also sorts its feature to a top row of the track,
  ahead of the row packer's order, and holds it there across pan and zoom.
- **By name**, `{"refName": "ctgA", "name": "EDEN"}`, matched exactly and
  case-insensitively within that refName. Prefer this. A name that is ambiguous
  (a gene and its same-named transcript) boxes both.
- **By span**, `{"refName": "ctgA", "start": 1049, "end": 9000}`, in interbase
  coordinates, matched within one base of the track's record. A location box
  reads the same feature as `ctgA:1,050-9,000`, so coordinates copied off the
  screen are a base short at the start. An entry carrying both forms falls back
  to `name` when the span misses.
- A span that resolves to nothing logs a console warning once data covering it
  has loaded; a name that resolves to nothing stays silent. The clear-highlights
  button in the view header removes them.

### Circular view

The circular view shows the whole genome, so there is no `loc`. It takes
`assembly`, `tracks`, `displayedRegionNames` (which chromosomes get an arc, in
that order, [globs](#glob-region-names) allowed) and `height`, which sizes the
drawing since the circle auto-fits its container.

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

`bpPerPx` and `offsetRadians` are the circle's zoom and rotation; pairing them
with `autoFit: false` stops the first resize refitting over them.

### Dotplot view

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

- `views[0]` is the horizontal axis and `views[1]` the vertical. Each takes an
  optional `loc` to navigate that axis; omit it for a whole-genome overview.
- Each also takes `displayedRegionNames`, which changes what the axis displays
  at all where `loc` navigates within it. A haplotype-resolved assembly shown
  whole interleaves both haplotypes, and `["*_hap1"]` on one axis plots one
  haplotype against the reference. It is applied before `autoDiagonalize`.

#### Dotplot view properties

<!-- SPEC_KEYS DotplotView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `autoDiagonalize` | After tracks load, automatically run the chromosome diagonalization pass so the bottom/vertical axis follows the top/horizontal axis. The canvas is hidden behind a "Reordering chromosomes…" spinner during the wait, so the user doesn't see an undiagonalized flash. |
| `highlight` | loc-strings ("chr1:100-200") or JSON objects matching HighlightType, mirroring LinearGenomeView's init.highlight |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`alpha`](/docs/models/dotplotview#property-alpha) | Plot-wide alpha applied to every point. View-level for the same reason lineWidth is: the only control is view-level, so storing it per display meant a track shown after the slider moved rendered at the default while the slider said otherwise. |
| [`assemblyNames`](/docs/models/dotplotview#property-assemblynames) | the two assemblies being compared, horizontal axis first. A spec normally names these per axis instead, as `views[0].assembly` and `views[1].assembly`. |
| [`colorBy`](/docs/models/trackcolorsmixin#property-colorby) | The color-by mode the whole view renders with, unless a track overrides it in `trackColorBy`. One of `default`, `strand`, `query`, `target`, `reference`, `identity`, `meanQueryIdentity`, `mappingQuality`, `dnds`, `track`. |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`drawCigar`](/docs/models/dotplotview#property-drawcigar) | resolve each alignment's CIGAR into the drawn shape rather than plotting it as a single straight segment |
| [`height`](/docs/models/dotplotview#property-height) | the height of the plot in pixels |
| [`hview`](/docs/models/dotplotview#property-hview) | the horizontal axis, as a full 1D view state. A spec writes `views[0]` instead, which the launcher resolves into this. |
| [`lineWidth`](/docs/models/dotplotview#property-linewidth) | Screen-space line width (CSS pixels) applied to every dotplot display in this view. View-level because the GPU pass renders all displays with one uniform. |
| [`lockAspectRatio`](/docs/models/dotplotview#property-lockaspectratio) | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square. Wheel zoom already preserves the ratio; box-zoom and other independent ops trigger an autorun resync. |
| [`lodMode`](/docs/models/dotplotview#property-lodmode) | Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all displays render at the same tier and the menu doesn't need to fan out per display. |
| [`minAlignmentLength`](/docs/models/dotplotview#property-minalignmentlength) | Hide alignments shorter than this many bp. Enforced per feature in buildLineSegments. Cuts whole-genome hairball noise. View-level, see alpha. |
| [`minIdentity`](/docs/models/dotplotview#property-minidentity) | Hide alignments whose sequence identity is below this fraction (0-1), enforced per feature in buildLineSegments beside minAlignmentLength. A feature carrying no identity at all is kept at every threshold — the alternative blanks a plot whose adapter simply never reported one. View-level, see alpha. |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`showColorLegend`](/docs/models/trackcolorsmixin#property-showcolorlegend) | Show the floating color-by legend. Dismissible via the legend's close button; re-enable from the color-by (palette) menu. |
| [`showGridlines`](/docs/models/dotplotview#property-showgridlines) | carry each axis' ruler ticks across the plot as faint lines, the way LinearGenomeView's gridlines carry its own down over the tracks |
| [`showHighlightChips`](/docs/models/highlightsmixin#property-showhighlightchips) | pins the interactive highlight chip (link icon + context menu) to every highlight band; off by default, where a band instead reveals its chip while the pointer is in it. This is what a screenshot needs, since nothing hovers in one |
| [`trackColorBy`](/docs/models/trackcolorsmixin#property-trackcolorby) | trackId -> color-by mode for that track alone. Absent means the track follows the view-wide `colorBy`. |
| [`trackColors`](/docs/models/trackcolorsmixin#property-trackcolors) | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. |
| [`trackSelectorType`](/docs/models/dotplotview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |
| [`vview`](/docs/models/dotplotview#property-vview) | the vertical axis, the counterpart to `hview`. A spec writes `views[1]`. |

<!-- SPEC_KEYS DotplotView END -->

#### Dotplot highlights

`highlight` works as it does on the linear genome view. A region draws as a
vertical band when its assembly matches the horizontal axis and a horizontal
band when it matches the vertical one, so on a self-vs-self plot it appears on
both. Include `assemblyName` to tie a band to one axis of a non-self plot.

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

### Linear synteny view

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

- Each entry in `views` is one genome row, a linear genome view, so it takes the
  [LGV's](#linear-genome-view) keys and launch props (`trackLabels`,
  `colorByCDS`, `showAminoAcids`), and its `tracks` entries take
  [inline display options](#advanced-track-configuration).
- `displayedRegionNames` restricts a row to a subset of its assembly, with
  [globs](#glob-region-names), so a whole-genome view can put one haplotype on
  each row (`["*_MATERNAL"]` above `["*_PATERNAL"]`). `loc` navigates within
  what a row displays and takes precedence.
- A self-self alignment is allowed.

#### Linear synteny view properties

Top-level fields set the view's initial display state. The same view colored by
strand, with curved ribbons and stronger opacity:

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

<!-- SPEC_KEYS LinearSyntenyView START -->

**Launch keys**, which name something to do on load rather than state the view
holds:

<!-- prettier-ignore -->
| Launch key | What it does |
| --- | --- |
| `autoDiagonalize` | After tracks load, automatically run the chromosome diagonalization pass so the bottom/vertical axis follows the top/horizontal axis. The canvas is hidden behind a "Reordering chromosomes…" spinner during the wait, so the user doesn't see an undiagonalized flash. |
| `collapseEmptyRows` | Open any genome row the launch gives no tracks collapsed to its ruler. The "No tracks active / Open track selector" block costs ~90px per row, which on a five-row launch is more of the viewport than the ribbons; a row is one click from expanding again (MiniControls, or the view menu's "Rows" → "Expand all views"). Off by default so an authored session keeps its rows as written — the launch dialog turns it on, and offers a checkbox to not. |
| `drawCurves` | Draw the ribbons as bezier curves rather than straight chords. Writes the promotable `drawCurves` config slot on every synteny track the launch opens; omit it to follow the viewer's session-wide default (straight when nothing is pinned). |
| `drawLocationMarkers` | Continue the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. The same config-slot write as `drawCurves`. |
| `levelHeights` | Pixel height of each synteny strip, one entry per level. Useful for whole-genome views where the default ~100px is too cramped for the ribbon detail to be readable. |
| `sameScale` | Put every genome row on one bp/px, the coarsest row's, instead of fitting each to the pane width. The largest genome then fills the frame and the rest are drawn shorter in proportion, so a size difference between rows (polyploidy, a genome duplication) is visible as length rather than hidden by the per-row stretch — and orthologs between two rows line up at the same scale on both. Applied last, after any autoDiagonalize pass. |

**Properties**, which are whatever the state model declares and the view
restores natively:

<!-- prettier-ignore -->
| Property | What it does |
| --- | --- |
| [`alpha`](/docs/models/linearsyntenyview#property-alpha) | Per-feature opacity in [0,1]. The default is tuned for dense unfiltered hairballs; a whole-genome view with minAlignmentLength set can use a higher value (~0.4) for stronger color. |
| [`bidirectionalFetch`](/docs/models/linearsyntenyview#property-bidirectionalfetch) | Ask each level's adapter for the alignments anchored on its LOWER row as well as its upper one.<br><br>A synteny band queries its query axis — the upper row of the pair — so an alignment anchored on a lower-row contig whose other end is somewhere the upper row is not showing is never requested, and nothing downstream can recover it. Which genome a user stacked on top therefore decided what the view was able to report.<br><br>A FETCH INPUT, unlike `showOffscreenMates` above, and off by default because it is a second query per level. |
| [`cigarMode`](/docs/models/linearsyntenyview#property-cigarmode) | How per-base insertions and deletions inside each alignment are shown: 'full' paints indel wedges, 'matches' leaves them see-through, 'off' draws blocks only. |
| [`colorBy`](/docs/models/trackcolorsmixin#property-colorby) | The color-by mode the whole view renders with, unless a track overrides it in `trackColorBy`. One of `default`, `strand`, `query`, `target`, `reference`, `identity`, `meanQueryIdentity`, `mappingQuality`, `dnds`, `track`. |
| [`displayName`](/docs/models/baseviewmodel#property-displayname) | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| [`fadeThinAlignmentsMode`](/docs/models/linearsyntenyview#property-fadethinalignmentsmode) | Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. 'auto' enables the fade once a display is dominated by sub-pixel ribbons (see `autoFadeWidthPx`); a genuinely sparse comparison (only a handful of ribbons) keeps full alpha so the fade doesn't wash it out. 'on'/'off' pin it. Resolved view-wide by the `fadeThinAlignments` getter, so all levels fade together. |
| [`followAnchorIndex`](/docs/models/linearcomparativeview#property-followanchorindex) | Which genome row drives the others while `followSynteny` is on. Every other row is placed by mapping this one's window outward one level at a time. Clamped to the views array by reconcileLevels. |
| [`followMatchOrientation`](/docs/models/linearcomparativeview#property-followmatchorientation) | While following, flip a row whose placing alignment runs the other way from the anchor's, so the two pan in the same direction. Off by default: the crossing ribbons are the picture of an inversion, and a row turning round under the reader is the loudest thing one can do. |
| [`followSynteny`](/docs/models/linearcomparativeview#property-followsynteny) | Move the non-anchor genome rows to whatever region aligns to the anchor row, re-resolved through the synteny data each time the anchor settles. The synteny-aware alternative to `linkViews`, which locks the rows in PIXELS and so drifts apart as soon as an indel accumulates — the two are mutually exclusive (see setRowSyncMode). |
| [`levels`](/docs/models/linearcomparativeview#property-levels) | One synteny band per adjacent pair of `views`. Each holds its own track list, which is why the track-selector and add-track widgets address them through `trackContainerFor` — a level is not a view and cannot be the target of their `view` reference. |
| [`linkViews`](/docs/models/linearcomparativeview#property-linkviews) | sync scroll and zoom across the genome rows, so panning one pans them all |
| [`lodMode`](/docs/models/linearsyntenyview#property-lodmode) | Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces the tier whose CIGAR is folded to its large indels (T/Q) when present. |
| [`minAlignmentLength`](/docs/models/linearsyntenyview#property-minalignmentlength) | Hide alignment blocks shorter than this many bp. Enforced per-feature by its own span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick engine. Cuts whole-genome hairball noise. |
| [`minimized`](/docs/models/baseviewmodel#property-minimized) | collapse the view to its header bar, keeping it in the session rather than closing it |
| [`opacityByIdentity`](/docs/models/linearsyntenyview#property-opacitybyidentity) | Fade alignment blocks by per-feature identity (lower identity = more transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without consuming the color channel. |
| [`overdrawPx`](/docs/models/linearsyntenyview#property-overdrawpx) | pixels beyond the visible viewport edge that synteny lines are still drawn. Effective up to the pan buffer (`syntenyPanBufferPx`: 2000px, or half the viewport when that is wider) — the worker emits CIGAR detail and location markers only that far, so a larger value draws ribbons whose detail stops partway along them. |
| [`showColorLegend`](/docs/models/trackcolorsmixin#property-showcolorlegend) | Show the floating color-by legend. Dismissible via the legend's close button; re-enable from the color-by (palette) menu. |
| [`showOffscreenMates`](/docs/models/linearsyntenyview#property-showoffscreenmates) | Mark, on the query axis, the alignments whose mate is on a contig the facing row is not displaying — real synteny a ribbon has nowhere to land, which the view otherwise draws nothing for. |
| [`trackColorBy`](/docs/models/trackcolorsmixin#property-trackcolorby) | trackId -> color-by mode for that track alone. Absent means the track follows the view-wide `colorBy`. |
| [`trackColors`](/docs/models/trackcolorsmixin#property-trackcolors) | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. |
| [`trackSelectorType`](/docs/models/linearcomparativeview#property-trackselectortype) | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. |

<!-- SPEC_KEYS LinearSyntenyView END -->

`levels` is accepted because the view declares it; `tracks` fills it, one entry
per level, and `levelHeights` sizes them, so reach for `levels` only to author a
band's full state.

#### Linear synteny view (multi-way)

`tracks` is then an array of arrays, one per level between adjacent rows:

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

`views` lists the two or more linear genome views that make up the split view,
each with its own location, assembly and tracks. Beside `views`, the spec
accepts every setting the view's menu offers:

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
| `baseUri` | what a relative `uri` resolves against. A config loaded from a URL stamps this beside every `uri` it carries, a `defaultSession` view's included, so the sheet's file resolves against the config the way a track's does |
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

`fileType` is one of `VCF`, `BED`, `BEDPE` or `STAR-Fusion`, for a URL with no
extension or a STAR-Fusion file, which has none of its own.

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
| `baseUri` | what a relative `uri` resolves against. A config loaded from a URL stamps this beside every `uri` it carries, a `defaultSession` view's included, so the sheet's file resolves against the config the way a track's does |
| `fileType` | the file's format. Otherwise detected from the extension, falling back to VCF, so name it for a file the extension does not identify |
| `filterText` | search-box text for the spreadsheet half, applied once the file is loaded. The circular half draws the rows it leaves, so this is what makes a chord subset reachable from a link |
| `uri` | the file to load into the sheet. A spec view is untyped user input, so this can be absent, and the view then opens on the import form |

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

A plugin makes its view launchable by registering a `LaunchView-<type>`
[extension point](/docs/developer_guides/extension_points). Once the plugin is
loaded, through the config's `plugins`, a hosted config, or a session's own
[`sessionPlugins`](#loading-a-plugin-from-a-url), a spec launches its view by
`type`. Each plugin documents its own fields:

- `ProteinView` from
  [`jbrowse-plugin-protein3d`](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md)
  (`uniprotId`, `transcriptId`, `url`, `connectedView`). See also the
  [proteins tutorial](/docs/tutorials/genomes_proteins).
- `MsaView` from
  [`jbrowse-plugin-msaview`](https://github.com/GMOD/jbrowse-plugin-msaview/blob/main/DEVELOPERS.md)
  (`msaFileLocation`, `treeFileLocation`, `connectedViewId`).

### Tiled views / Workspaces

A spec's `layout` arranges its views into a tiled workspace, and turns
workspaces mode on by doing so. It is a tree of two kinds of node:

- a **panel**, carrying a `views` array of indices into the spec's own `views`,
  stacked vertically. An index names every view that entry created: a
  [`ProteinView`](#plugin-provided-view-types) with a `connectedView` opens its
  genome view and then the structure, and its index is the pair, stacked. An
  entry may also be a view id the spec pinned with
  [`id`](#fields-every-view-takes), to place one of those views on its own
- a **container**, carrying `children` and a `direction`: `"horizontal"`,
  `"vertical"` or `"tabs"` (one tab group, one child visible at a time)

Containers nest arbitrarily deep. An index past the end, or an id no view in the
spec has, is reported and left out of the layout. The live session takes the
same shape: `session.applyLayoutSpec(layout)` (see
[the live model guide](/docs/agents_live_model)) counts a panel's indices into
`session.views` instead, and refuses a panel spelled any other way.

Views 0 and 1 stacked in a left panel taking 70% of the width, view 2 alone on
the right:

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
    "children": [
      { "views": [0, 1], "size": 70 },
      { "views": [2], "size": 30 }
    ]
  }
}
```

- `size` is a panel's proportion of the split, at any depth: a nested container
  sizes its own children as well as taking a share of its parent.
- Size every sibling and the numbers are proportions, so `7` and `3` lay out the
  same as `70` and `30`. Leave one bare and they are read as percentages, the
  bare panel taking what the sized ones leave: `70` beside a bare panel is
  70/30, and `7` beside a bare panel is 7/93.
- Dragging the divider adjusts from there, and the position is saved with the
  session.

A fixed reference panel on the left, and a set of tabs to page through on the
right:

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

- The first child of a `tabs` node is the tab shown. Tabs can be renamed by
  double-clicking and dragged out into a split.
- A `tabs` node is the one container whose `size` does not divide space, so a
  `size` on its children describes nothing, and a container nested inside it has
  its views gathered into a single tab. A spec that does either says so in a
  notification when it loads.

## Other session formats

Besides `spec-`, `&session=` takes four formats that carry a session snapshot
rather than instructions for building one.

### &session=json-

A plain JSON snapshot, the shape "Export session..." produces, and the Share
button's "Plaintext JSON" option: the longest format, and the one to read.

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"name":"MsaView","url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

### &session=encoded-

The same snapshot as base64 plus gzip, the Share button's "Long URL" option. It
works without the session-sharing server, and because it is long the Share
button puts it [in the fragment](#query-string-or-hash-fragment).

```
https://jbrowse.org/code/jb2/latest/#session=encoded-eJyNU2FzmkAQ_SvOfaaNIKDyLbFN0xlrTWRqnU4mc8ACm8BB7k6Ndfj...
```

### &session=local-

`https://host/jbrowse2/?session=local-Fjphq8kjY`. A loaded session is stored in
sessionStorage and IndexedDB and the URL bar switches to this form. The same tab
restores from sessionStorage; a new tab on the same machine restores from
IndexedDB.

### &session=share-

`https://host/jbrowse2/?session=share-HShsEcnq3i&password=nYzTU`, from the Share
button.

- The client mints a random key, encrypts the session and uploads the blob
  without the key to a DynamoDB store. The recipient decrypts with the key in
  the URL, so the store's contents cannot be read even by JBrowse
  administrators.
- Behind a firewall that cannot reach the shortener, the Share dialog's gear
  icon switches to "Long URL". `shareURL` in the config points at a shortener of
  your own.

#### Are share links reproducible

- The short link is not: each click mints a new key and uploads a new blob, so
  the same view gives a new id and password every time.
- "Long URL" and "Plaintext JSON" are: both carry the whole session in the link,
  so the same view and config produce the same link, and it survives moving the
  instance.
- The config can still break either. A restored session names tracks by
  `trackId`, so a redeploy that regenerates `config.json` with different ids
  leaves the link unable to find them
  ([keeping trackIds stable](/docs/config_guides/deploying/#keep-trackids-stable-for-reproducible-links)).

### Loading a plugin from a URL

A snapshot's `sessionPlugins` array is the only way to name a plugin in the URL
itself. It takes the same definitions a config's `plugins` array takes, works in
all four snapshot formats, and the plugin belongs to that session rather than
being installed for the user.

- **`name` is required for a UMD bundle**, the `.umd.production.min.js` builds
  the plugin store publishes. The loader resolves the bundle as the global
  `JBrowsePlugin<Name>`, so a definition carrying only a `url` loads the script
  and then finds nothing in it.
- **An unrecognized plugin prompts the visitor.** Anything not served from
  `https://jbrowse.org/plugins/` and not in the
  [plugin store](https://jbrowse.org/jb2/plugin_store/) opens an "unknown
  plugins" dialog before the session loads, since a plugin is arbitrary
  JavaScript running with the page's privileges. A config's `plugins` are gated
  the same way, but only when the config is cross-origin.
- **A JSON session is state.** A plugin's view type opened this way is
  instantiated straight from the snapshot, so anything its
  [launcher](#plugin-provided-view-types) would have resolved has to be written
  out. Build the session in the app and copy it out of Share, gear, "Plaintext
  JSON".
- **These URLs get long.** Put the session
  [in the fragment](#query-string-or-hash-fragment), and `config=` with it,
  since a fragment containing `=` makes JBrowse ignore the query string.

For everyone opening a config to have the plugin, put it in that config's own
`plugins` array.

## See also

- [](/docs/automating)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/config_guides/default_session)
- [](/docs/developer_guides/extension_points)
