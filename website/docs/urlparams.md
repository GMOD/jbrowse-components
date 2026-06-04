---
title: URL query parameter API
---

JBrowse Web supports URL parameters for initializing a session.

:::note

Embedded components like @jbrowse/react-linear-genome-view2 make no assumptions
about URL parameters — that logic must be implemented by the consuming
application.

:::

## Linear genome view (simple)

A simplified URL format for launching a single linear genome view:

`http://host/jbrowse2/?config=test_data/config.json&loc=chr1:6000-7000&assembly=hg19&tracks=gene_track,vcf_track`

Allowed query parameters:

### ?config=

Example

`?config=test_data/volvox/config.json`

A path to a JBrowse 2 config file, relative to the current folder on the disk.
Note that this just uses client-side fetch to read the file, not server-side
file reads. If ?config= is not specified, it looks for a file named config.json
e.g. http://host/jbrowse2/config.json, which is what the @jbrowse/cli tool sets
up by default.

The special value `?config=none` skips loading a config file entirely. This is
useful with `&hubURL=` (below), which supplies its own assemblies and tracks.

### &assembly=

Example

`&assembly=hg19`

`&assembly=` refers to the `name` field of an entry in the `assemblies` array of
config.json. Only used when launching a single linear genome view.

### &loc=

Example

`&loc=chr1:6000-7000`

Navigates to this region on load. Accepts the formats shown below. This is only
used for launching a single linear genome view.

Example strings

```
&loc=chr1:6000-7000 // using - notation for range
&loc=chr1:6000..7000 // using .. notation for range
&loc=chr1:7000 // centered on this position
&loc=GENEID // if you have used `jbrowse text-index`
```

Navigating via `&loc=GENEID` requires a text index built with
`jbrowse text-index`.

For specialized navigation (e.g. combining URL navigation with a
`defaultSession`), a small plugin is the recommended approach —
[see this example](https://gist.github.com/cmdcolin/eedfcb11f8f153ba1fb07e56dfddd3b3).

### &highlight=

Example

`&highlight=chr1:6000-7000`

This will create a highlight over the specified region when combined with
[&assembly=](#assembly) and [&loc=](#loc).

Multiple highlight locations can be specified by delimiting locations with a
space (URL-encoded as `%20`):

`&highlight=chr1:6000-7000%20chr1:7100-7200`

Note: `&assembly=` should always accompany `&highlight=` — the highlight is
stored with the assembly name so that downstream features (e.g. bookmarking the
highlighted region from the chip menu) can resolve it. The highlight will still
render without an assembly in a single-assembly view if the refName matches a
displayed region, but it is not portable across assemblies and may fail in
actions that require a fully-qualified region. The same caveat applies when
authoring `view.highlight` directly in a session JSON: include `assemblyName` on
each entry.

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

Multiple JSON highlights can be combined with space delimiters (`%20` after
URL-encoding), and loc strings and JSON objects can be mixed in the same
`&highlight=` value.

### &tracklist=

Example

`&tracklist=true`

Opens the track selector on load. Default: false.

### &nav=

Example

`&nav=false`

Turns off the navigation bar of the linear genome view. Default true. This is
only used for launching a single linear genome view.

### &tracks=

Example

`&tracks=gene_track,vcf_track`

This is a comma-separated list of trackIds. You can find your trackIds in the
config.json. Note, you can also refer to a trackId added by &sessionTracks=
here. This is only used for launching a single linear genome view.

### &sessionTracks=

If you want to dynamically add a track to the session, you can do so with
`&sessionTracks=`

You can also use this method to add a `FromConfigAdapter` track, which lets you
specify features in JSON format, so you can e.g. add BLAST hits via the URL bar.

Example

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL%20track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}])

This creates a track dynamically that has a single feature at `ctgA:100-200`.

The data to supply to `&sessionTracks=` is an array of track configs, and in the
above URL, looks like this when pretty-printed

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

Sets the session name displayed in the header bar. This parameter works with all
session types including:

- Default sessions (loaded from config)
- Session specs (`&session=spec-...`)
- Hub sessions (`&hubURL=...`)

This is useful for giving meaningful names to sessions launched via URL, rather
than using auto-generated names with timestamps. The value should be URL-encoded
if it contains special characters or spaces.

### &hubURL=

Example

`&hubURL=https://example.com/hub.txt&config=none`

Intended to load one or more UCSC track hubs as a session (multiple hubs as a
comma-separated list), typically combined with `?config=none` since the hub
supplies its own assemblies and tracks.

:::note

This parameter is experimental and may not be fully functional — verify it works
for your use case before relying on it.

:::

## Session spec

### Linear genome view

A "session spec" encodes a session as JSON in the URL. Each view object is the
serialized form of a view's declarative `init` field; the embedded
`@jbrowse/react-linear-genome-view2` component accepts the same shape directly
via `defaultSession.view.init` (it does not parse URLs itself).

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type": "LinearGenomeView","tracks":["gff3tabix_genes","volvox_filtered_vcf","volvox_microarray","volvox_cram"]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type":"LinearGenomeView","tracks":["gff3tabix_genes","volvox_filtered_vcf","volvox_microarray","volvox_cram"]}]})

Expanded JSON of the contents of the URL

```json
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
`loc`, `tracks`, `assembly`, and view type. Different view types accept
different params — dotplot, for example, takes two assemblies.

You can also use `&sessionName=` with session specs to set a custom session
name:

```
&session=spec-{...}&sessionName=My%20Analysis
```

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
            "type": "LinearPileupDisplay",
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
  - `type`: Override the display type (e.g., `LinearPileupDisplay`,
    `LinearSNPCoverageDisplay`, `LinearAlignmentsDisplay`)
  - `height`: Display height in pixels
  - `color`: Feature color for feature/wiggle tracks (a CSS color, or a `jexl:`
    expression for per-feature coloring)
  - `minScore`, `maxScore`: Score range for quantitative tracks
  - Other display-specific settings
- `trackSnapshot` (optional): Initial track state such as `pinned: true`

This is useful for:

- Opening a track with a specific display type
- Setting initial display height or color scheme
- Configuring autoscale settings for quantitative tracks

#### Live example: alignments display settings

`displaySnapshot` is not limited to overriding the display `type` — it can set
any of the display's own settings. This opens an alignments track colored by
pair orientation, with soft-clipped bases shown and an enlarged height:

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-10000","type":"LinearGenomeView","tracks":[{"trackId":"volvox_sv_cram","displaySnapshot":{"height":250,"showSoftClipping":true,"colorBySetting":{"type":"pairOrientation"}}}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-10000","type":"LinearGenomeView","tracks":[{"trackId":"volvox_sv_cram","displaySnapshot":{"height":250,"showSoftClipping":true,"colorBySetting":{"type":"pairOrientation"}}}]}]})

Expanded JSON:

```json
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
            "colorBySetting": { "type": "pairOrientation" }
          }
        }
      ]
    }
  ]
}
```

#### Live example: feature track color

Setting a track's color is one of the most common things people want to do. For
a feature track (genes, BED, GFF), put `color` in the `displaySnapshot` — it
accepts a plain CSS color, or a `jexl:` expression to color per-feature. This
opens the genes track colored green:

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":[{"trackId":"gff3tabix_genes","displaySnapshot":{"color":"green"}}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":[{"trackId":"gff3tabix_genes","displaySnapshot":{"color":"green"}}]}]})

Expanded JSON:

```json
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

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type": "CircularView","tracks":["volvox_sv_test"]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type":"CircularView","tracks":["volvox_sv_test"]}]})

Expanded

```json
{
  "views": [
    {
      "assembly": "volvox",
      "loc": "ctgA:1-5100",
      "type": "CircularView",
      "tracks": ["volvox_sv_test"]
    }
  ]
}
```

### Dotplot view

Example (self-vs-self alignment):

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_main_thread.json&session=spec-%7B"views":%5B%7B"type":"DotplotView","views":%5B%7B"assembly":"volvox"%7D,%7B"assembly":"volvox"%7D%5D,"tracks":%5B"volvox_fake_synteny"%5D%7D%5D%7D
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_main_thread.json&session=spec-%7B"views":%5B%7B"type":"DotplotView","views":%5B%7B"assembly":"volvox"%7D,%7B"assembly":"volvox"%7D%5D,"tracks":%5B"volvox_fake_synteny"%5D%7D%5D%7D)

Expanded example, see that it is a self-self alignment

```json
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
vertical); omit `loc` for a whole-genome overview:

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

#### Dotplot highlights

The dotplot view accepts a `highlight` array in the same way the linear genome
view does (see [&highlight=](#highlight)). Each entry is a loc string (or a
URL-encoded `HighlightType` JSON object with optional `color`/`label`). A region
is drawn as a translucent **vertical** band when its assembly matches the
horizontal axis and as a **horizontal** band when it matches the vertical axis —
so on a self-vs-self plot it appears on both axes:

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox","loc":"ctgA:1-50000"},{"assembly":"volvox","loc":"ctgA:1-50000"}],"tracks":["volvox_fake_synteny"],"highlight":["ctgA:5000-15000"]}]}
```

Expanded JSON:

```json
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

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B%22views%22:%5B%7B%22type%22:%22SpreadsheetView%22,%20%22uri%22:%22test_data/volvox/volvox.filtered.vcf.gz%22,%22assembly%22:%22volvox%22%7D%5D%7D
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B%22views%22:%5B%7B%22type%22:%22SpreadsheetView%22,%20%22uri%22:%22test_data/volvox/volvox.filtered.vcf.gz%22,%22assembly%22:%22volvox%22%7D%5D%7D)

Expanded

```json
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

### SV inspector

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B"views":%5B%7B"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"%7D%5D%7D
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B%22views%22:%5B%7B%22type%22:%22SvInspectorView%22,%20%22uri%22:%22test_data/volvox/volvox.dup.vcf.gz%22,%22assembly%22:%22volvox%22%7D%5D%7D)

Expanded

```json
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

### Linear synteny view

```
https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":["volvox_fake_synteny"],"views":[{"loc":"ctgA:1-30000","assembly":"volvox"},{"loc":"ctgA:1000-31000","assembly":"volvox"}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":["volvox_fake_synteny"],"views":[{"loc":"ctgA:1-30000","assembly":"volvox"},{"loc":"ctgA:1000-31000","assembly":"volvox"}]}]})

Expanded, again showing a self-self alignment is allowed

```json
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

### Breakpoint split view

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"BreakpointSplitView","views":[{"loc":"ctgA:1-5000","assembly":"volvox","tracks":["volvox_cram"]},{"loc":"ctgB:1-5000","assembly":"volvox","tracks":["volvox_cram"]}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"BreakpointSplitView","views":[{"loc":"ctgA:1-5000","assembly":"volvox","tracks":["volvox_cram"]},{"loc":"ctgB:1-5000","assembly":"volvox","tracks":["volvox_cram"]}]}]})

Expanded

```json
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
tracks.

### Linear synteny view (multi-way)

```
https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":[["volvox_ins.paf"],["volvox_del.paf"]],"views":[{"loc":"ctgA:1-50000","assembly":"volvox_ins"},{"loc":"ctgA:1000-50000","assembly":"volvox"},{"loc":"ctgA:1000-44000","assembly":"volvox_del"}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":[["volvox_ins.paf"],["volvox_del.paf"]],"views":[{"loc":"ctgA:1-50000","assembly":"volvox_ins"},{"loc":"ctgA:1000-50000","assembly":"volvox"},{"loc":"ctgA:1000-44000","assembly":"volvox_del"}]}]})

Expanded (the `tracks` field is a multidimensional array — each sub-array
corresponds to the synteny tracks at one level of the multi-way view)

```json
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

### Tiled views / Workspaces

You can use the `layout` parameter in a session spec to arrange multiple views
into a tiled workspace layout. The `layout` parameter uses a nested structure
where each node is either:

- A **panel** (has `views` array) - displays views stacked vertically
- A **container** (has `children` array) - arranges children horizontally or
  vertically

#### Horizontal split example

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:5000-10000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0,1]},{"views":[2]}]}}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:5000-10000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0,1]},{"views":[2]}]}})

```json
{
  "views": [
    { "type": "LinearGenomeView", "assembly": "volvox", "loc": "ctgA:1-5000" },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:5000-10000"
    },
    { "type": "LinearGenomeView", "assembly": "volvox", "loc": "ctgB:1-5000" }
  ],
  "layout": {
    "direction": "horizontal",
    "children": [{ "views": [0, 1] }, { "views": [2] }]
  }
}
```

This creates a left-right split:

- **Left panel** contains views 0 and 1 stacked vertically
- **Right panel** contains view 2

#### Custom panel sizes

You can specify the `size` property to control the proportional width/height of
panels:

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0],"size":70},{"views":[1],"size":30}]}}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0],"size":70},{"views":[1],"size":30}]}})

```json
{
  "views": [
    { "type": "LinearGenomeView", "assembly": "volvox", "loc": "ctgA:1-5000" },
    { "type": "LinearGenomeView", "assembly": "volvox", "loc": "ctgB:1-5000" }
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

#### Complex nested layout example

You can create more complex layouts by nesting containers:

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:5000-10000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:5000-10000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0,1]},{"direction":"vertical","children":[{"views":[2]},{"views":[3]}]}]}}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgA:5000-10000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:1-5000","tracks":["gff3tabix_genes"]},{"type":"LinearGenomeView","assembly":"volvox","loc":"ctgB:5000-10000","tracks":["gff3tabix_genes"]}],"layout":{"direction":"horizontal","children":[{"views":[0,1]},{"direction":"vertical","children":[{"views":[2]},{"views":[3]}]}]}})

```json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-5000"
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:5000-10000"
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:1-5000"
    },
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgB:5000-10000"
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

- **Left panel** with views 0 and 1 stacked
- **Right side** split vertically into two panels (view 2 on top, view 3 on
  bottom)

The `layout` parameter:

- Automatically enables workspaces mode
- `direction` can be `"horizontal"` (left-right) or `"vertical"` (top-bottom)
- `views` is an array of view indices (referencing the `views` array)
- `size` is an optional number specifying the proportional size of a panel
- Views within the same panel are stacked vertically
- Layouts can be nested arbitrarily deep

## Other session options

### &session=json-

Similar to encoded sessions, but more readable, `&session=json-` type sessions
let you specify the input as a JSON snapshot of a session. This is slightly
different from a session spec, which has extra logic that loads the session.
JSON sessions are literal session snapshots, like those that might come from the
"Export session..." process.

Example

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

This loads a session with an extra plugin loaded.

### &session=encoded-

This is similar to JSON sessions but uses a URL encoding (base64+gzip)

Example

```
https://jbrowse.org/code/jb2/latest/?session=encoded-eJyNU2FzmkAQ_SvOfaaNIKDyLbFN0xlrTWRqnU4mc8ACm8BB7k6NdfjvXcCiZpq23-Dt2923u-_2DCPmsevHMn0ePT2umMEEz4GgGWx7C1AKC9EzzQv7wupbpkGfntX3HKt3-YW4OZcJCub1DRZJvgW5xEinzBuMbINtELaKeT_2bY98E0ym_PvdR8rTu7LuMUUBXH4CUeTwjdgUKeJYgZ6_MM-yLWtsGiwo5yBrwBkO3w9dx3b7I3fsuI5FTVGVGd9BdAcJCW27SYhn7QxDKqg0l7pRCIJkmM7YHIxcd2AQbwNSAYExzxQYjCsFeZDtDtlpYo5ZdU9qJQ-fTiZxxrPVYGrf-sdJroHrtQS_ZhIaFiLGZC25JlUUFmGAD0kcPzQ1O90nNQe72dU0eC716vV6rrjC8EObQLEUMElpINu0_tHn3R_yq_t6oBQjuAEegexmP0JfaSv16bpQM_4CMgh1If1WWooguQxTDHnGDpQpDyCjkVhBFTJeliiS-gBpsZ2A0CBrPV3VBt7pIuAiUgvQumZ7Wq6hVrjFKAFNxfZnrfxTKXWw2d3bjG6VN29Rlk2j5mQZaW7ssK8MFmNGin14oVUz1pr5zMQVkXiocQPL_9L6l1jVHFLQD13xsyDHihBqb9AiVPsE_d8WPEKTLuUcv2xdjK8qzLM1PdUDlqPAHH-eeL99vvNC4cFKsrFZ9QuCGmjL
```

Note that the "Share" button has a gear icon that lets you select "Long URL"
that produces these URLs. The encoded share links can be used without the
central session sharing system in place, as the entire session is encoded in the
URL.

### &session=local-

The local sessions look like this

https://host/jbrowse2/?session=local-Fjphq8kjY

By default, after a session is loaded, it is stored into sessionStorage and
IndexedDB, and then the URL bar uses the ?session=local- format to reflect the
session ID. Pasting the URL in the same browser tab restores from
sessionStorage; pasting it into a new tab on the same machine restores from
IndexedDB.

### &session=share-

If you click the "Share button" in the header bar, it will generate a "shareable
link" that you can give to other users

https://host/jbrowse2/?session=share-HShsEcnq3i&password=nYzTU

See
[this FAQ entry for more info about how shared sessions work](/docs/faq/#how-does-session-sharing-with-shortened-urls-work-in-jbrowse-web)
