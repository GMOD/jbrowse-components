---
id: urlparams
title: URL query parameter API
toplevel: true
---

import Figure from './figure'

JBrowse Web features the ability to automatically provide URL parameters to
setup a session

Note that the embedded components like @jbrowse/react-linear-genome-view make no
assumptions on how URL params are used, so would have to be implemented by the
consumer of the library

## Linear genome view (simple)

We provide a simplified URL format specifically designed for launching a single
linear genome view

Example

`http://host/jbrowse2/?config=test_data/config.json&loc=chr1:6000-7000&assembly=hg19&tracks=gene_track,vcf_track`

Here are the query params used here

### ?config=

Example

`?config=test_data/volvox/config.json`

A path to a JBrowse 2 config file, relative to the current folder on the disk.
Note that this just uses client side fetch to read the file, not server side
file reads. If ?config= is not specified, it looks for a file named config.json
e.g. http://host/jbrowse2/config.json which is what the @jbrowse/cli tool sets
up by default

### &assembly=

Example

`&assembly=hg19`

The &assembly parameter refers to an assembly's "name" field one of the
"assemblies" array in the from the config.json. This is only used for launching
a single linear genome view.

### &loc=

Example

`&loc=chr1:6000-7000`

This performs a navigation to this region on load, which can be specified using
the syntax. This is only used for launching a single linear genome view.

Example strings

```
&loc=chr1:6000-7000 // using - notation for range
&loc=chr1:6000..7000 // using .. notation for range
&loc=chr1:7000 // centered on this position
&loc=GENEID // if you have used `jbrowse text-index`
```

Note 1: Navigating via &loc=GENEID using the text-index was added in v2.9.0

Note 2: If you have a specialized use case for navigating, e.g. you need to
combine URL navigation with defaultSession, then you might consider making a
small plugin to do so. Here is a code listing example:
https://gist.github.com/cmdcolin/eedfcb11f8f153ba1fb07e56dfddd3b3

### &highlight=

Example

`&highlight=chr1:6000-7000`

This will create a highlight over the specified region when combined with
[&assembly=](#assembly) and [&loc=](#loc).

Multiple highlight locations can be specified by delimiting locations with a
space:

`&highlight=chr1:6000-7000 chr1:7100-7200`

### &tracklist=

Example

`&tracklist=true`

This opens the track selector by default. Default false

### &nav=

Example

`&nav=false`

Turns off the navigation bar of the linear genome view

### &tracks=

Example

`&tracks=gene_track,vcf_track`

This is a comma separated list of trackIds. You can see your trackId's in the
config.json. Note, you can also refer to a trackId added by &sessionTracks=
here. This is only used for launching a single linear genome view.

### &sessionTracks=

If you want to dynamically add a track to the session, you can do so with
`&sessionTracks=`

You can also use this method to add a `FromConfigAdapter` track, which let's you
specify features in JSON format, so you can e.g. add BLAST hits via the URL bar

Example

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}]
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-800&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL%20track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"ctgA","start":100,"end":200,"name":"Boris"}]}}])

This creates a track dynamically that has a single feature at `chr1:100-200`

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
          "start": 190,
          "end": 191,
          "name": "Boris"
        }
      ]
    }
  }
]
```

## Session spec

### Linear genome view

We can specify a "session spec" (short for specification) using JSON

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

As you can see, you can supply an array of views (so you can open multiple views
at once) and can specify the loc, tracks, assembly, and view type, or other view
specific parameters (different view types may accept different params, e.g.
dotplot has two assemblies)

### Circular view

Here is an example of a JSON session spec for a Circular View

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

Here is an example of a JSON session spec for a dotplot view (self-vs-self
alignment)

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_main_thread.json&session=spec-%7B"views":%5B%7B"type":"DotplotView","views":%5B%7B"assembly":"volvox"%7D,%7B"assembly":"volvox"%7D%5D,"tracks":%5B"volvox_fake_synteny"%5D%7D%5D%7D
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_main_thread.json&session=spec-%7B"views":%5B%7B"type":"DotplotView","views":%5B%7B"assembly":"volvox"%7D,%7B"assembly":"volvox"%7D%5D,"tracks":%5B"volvox_fake_synteny"%5D%7D%5D%7D)

Expanded

```json
{
  "views": [
    {
      "type": "DotplotView",
      "views": [{ "assembly": "volvox" }, { "assembly": "volvox" }], //  (self vs self alignment)
      "tracks": ["volvox_fake_synteny"]
    }
  ]
}
```

Note that this dotplot session spec doesn't have the ability to navigate to
specific regions on the assembly yet, it just navigates to a whole genome
overview

### Spreadsheet view

Here is an example of a JSON session spec for a Spreadsheet View

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

Here is an example of a JSON session spec for a SV Inspector View

```
https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B"views":%5B%7B"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"%7D%5D%7D
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-%7B%22views%22:%5B%7B%22type%22:%22SvInspectorView%22,%20%22uri%22:%22test_data/volvox/volvox.dup.vcf.gz%22,%22assembly%22:%22volvox%22%7D%5D%7D)

Expanded

```
{
  views: [
    {
      type: "SvInspectorView",
      uri: "test_data/volvox/volvox.dup.vcf.gz",
      assembly: "volvox",
    },
  ],
};
```

### Linear synteny view

Here is an example of a JSON session spec for a linear synteny view

```
https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":["volvox_fake_synteny"],"views":[{"loc":"ctgA:1-30000","assembly":"volvox"},{"loc":"ctgA:1000-31000","assembly":"volvox"}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":["volvox_fake_synteny"],"views":[{"loc":"ctgA:1-30000","assembly":"volvox"},{"loc":"ctgA:1000-31000","assembly":"volvox"}]}]})

Expanded

```json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": ["volvox_fake_synteny"], //  (self vs self alignment)
      "views": [
        { "loc": "ctgA:1-30000", "assembly": "volvox" },
        { "loc": "ctgA:1000-31000", "assembly": "volvox" }
      ]
    }
  ]
}
```

### Linear synteny view (multi-way)

Here is an example of a JSON session spec for a linear synteny view, but with
more than two views

```
https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":[["volvox_ins.paf"],["volvox_del.paf"]],"views":[{"loc":"ctgA:1-50000","assembly":"volvox_ins"},{"loc":"ctgA:1000-50000","assembly":"volvox"},{"loc":"ctgA:1000-44000","assembly":"volvox_del"}]}]}
```

[Live link](https://jbrowse.org/code/jb2/main/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-{"views":[{"type":"LinearSyntenyView","tracks":[["volvox_ins.paf"],["volvox_del.paf"]],"views":[{"loc":"ctgA:1-50000","assembly":"volvox_ins"},{"loc":"ctgA:1000-50000","assembly":"volvox"},{"loc":"ctgA:1000-44000","assembly":"volvox_del"}]}]})

Expanded

```json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": [["volvox_ins.paf"],["volvox_del.paf"]], // this multidimensional array refers to the synteny tracks at each level of the multi-level synteny view
      "views": [
        { "loc": "ctgA:1-50000", "assembly": "volvox-ins" },
        { "loc": "ctgA:1000-50000", "assembly": "volvox" }
        { "loc": "ctgA:1000-44000", "assembly": "volvox-del" }
      ]
    }
  ]
}
```

## Other session options

Another useful session URL is called a "session spec" or "session
specification". This provides a way to launch multiple views at once, including
view types other than the linear genome view

### &session=json-

Similar to encoded sessions, but more readable, `&session=json-` type sessions
let you specify the input a JSON snapshot of a session session. This is slightly
different from a session spec, which has extra logic that loads the session.
JSON sessions are literal session snapshots, like those that might come from the
"Export session..." process

Example

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

This loads a session with an extra plugin loaded

### &session=encoded-

This is similar to JSON sessions but uses a URL encoding (base64+gzip)

Example

```
https://jbrowse.org/code/jb2/v1.5.9/?session=encoded-eJyNU2FzmkAQ_SvOfaaNIKDyLbFN0xlrTWRqnU4mc8ACm8BB7k6NdfjvXcCiZpq23-Dt2923u-_2DCPmsevHMn0ePT2umMEEz4GgGWx7C1AKC9EzzQv7wupbpkGfntX3HKt3-YW4OZcJCub1DRZJvgW5xEinzBuMbINtELaKeT_2bY98E0ym_PvdR8rTu7LuMUUBXH4CUeTwjdgUKeJYgZ6_MM-yLWtsGiwo5yBrwBkO3w9dx3b7I3fsuI5FTVGVGd9BdAcJCW27SYhn7QxDKqg0l7pRCIJkmM7YHIxcd2AQbwNSAYExzxQYjCsFeZDtDtlpYo5ZdU9qJQ-fTiZxxrPVYGrf-sdJroHrtQS_ZhIaFiLGZC25JlUUFmGAD0kcPzQ1O90nNQe72dU0eC716vV6rrjC8EObQLEUMElpINu0_tHn3R_yq_t6oBQjuAEegexmP0JfaSv16bpQM_4CMgh1If1WWooguQxTDHnGDpQpDyCjkVhBFTJeliiS-gBpsZ2A0CBrPV3VBt7pIuAiUgvQumZ7Wq6hVrjFKAFNxfZnrfxTKXWw2d3bjG6VN29Rlk2j5mQZaW7ssK8MFmNGin14oVUz1pr5zMQVkXiocQPL_9L6l1jVHFLQD13xsyDHihBqb9AiVPsE_d8WPEKTLuUcv2xdjK8qzLM1PdUDlqPAHH-eeL99vvNC4cFKsrFZ9QuCGmjL
```

Note that the "Share" button has a gear icon that let's you select "Long URL"
that produces these URLs. The encoded share links can be used without the
central session sharing system in place, as the entire session is encoded in the
URL.

### &session=local-

The local sessions look like this

https://host/jbrowse2/?session=local-Fjphq8kjY

By default, after a session is loaded, it is stored into localStorage, and then
the URL bar uses the ?session=local- format to reflect the key of the
localStorage entry.

### &session=share-

If you click the "Share button" in the header bar, it will generate a "shareable
link" that you can give to other users

https://host/jbrowse2/?session=share-HShsEcnq3i&password=nYzTU

See
[this FAQ entry for more info about how shared sessions work](/docs/faq/#how-does-the-session-sharing-work-with-shortened-urls-work-in-jbrowse-web)
