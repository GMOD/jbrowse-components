---
id: urlparams
title: URL query parameter API
toplevel: true
---

import Figure from './figure'

JBrowse Web features the ability to automatically provide URL parameters to
setup a session

Note that the embedded components like @jbrowse/react-linaer-genome-view make
no assumptions on how URL params are used, so would have to be implemented by
the consumer of the library

## Simple API for linear genome view

We provide a simplified URL format specifically designed for launching a single
linear genome view

Example

http://host/jbrowse2/?config=test_data/config.json&loc=chr1:6000-7000&assembly=hg19&tracks=gene_track,vcf_track

Here are the query params used here

### ?config=

E.g. config=test_data/volvox/config.json

A path to a JBrowse 2 config file, relative to the current folder on the disk.
Note that this just uses client side fetch to read the file, not server side
file reads. If ?config= is not specified, it looks for a file named config.json
e.g. http://host/jbrowse2/config.json which is what the @jbrowse/cli tool sets
up by default

### &assembly=

E.g. &assembly=hg19

The &assembly parameter refers to an assembly's "name" field one of the
"assemblies" array in the from the config.json.

### &loc=

E.g. &loc=chr1:6000-7000

This performs a navigation to this region on load, which can be specified using
the syntax

Example strings

```
chr1:6000-7000 // using - notation for range
chr1:6000..7000 // using .. notation for range
chr1:7000 // centered on this position
```

Note: Navigating via a text search query e.g. supply &loc=gene_name is not yet supported

### &tracks=

E.g. &tracks=gene_track,vcf_track

This is a comma separated list of trackIds. You can see your trackId's in the
config.json. Note, you can also refer to a trackId added by &sessionTracks=
here

## More URL paramters

### &sessionTracks=

If you want to dynamically add a track to the session, you can do so with
&sessionTracks=

You can also use this method to add a FromConfigAdapter track, which let's you
specify features in JSON format, so you can e.g. add BLAST hits via the URL bar

Example

```
http://localhost:3000/?config=test_data/volvox/config.json&loc=ctgA:6000-7000&assembly=volvox&tracks=gff3tabix_genes,volvox_filtered_vcf,volvox_microarray,volvox_cram,url_track&sessionTracks=[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["hg19"],"adapter":{"type":"FromConfigAdapter","features":[{"uniqueId":"one","refName":"chr1","start":100,"end":200,"name":"Boris"}]}}]
```

This creates a track dynamically that has a single feature at chr1:100-200

The data to supply to &sessionTracks= is an array of track configs, and in the
above URL, looks like this when pretty-printed

```json
[
  {
    "type": "FeatureTrack",
    "trackId": "url_track",
    "name": "URL track",
    "assemblyNames": ["hg19"],
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

### &session=

The session parameter, e.g. &session= has a number of different "input formats"

#### Local sessions

The local sessions look like this

https://host/jbrowse2/?session=local-Fjphq8kjY

By default, after a session is loaded, it is stored into localStorage, and then
the URL bar uses the ?session=local- format to reflect the key of the
localStorage entry.

#### Shared sessions

If you click the "Share button" in the header bar, it will generate a
"shareable link" that you can give to other users

https://host/jbrowse2/?session=share-HShsEcnq3i&password=nYzTU

See [this FAQ entry for more info about how shared sessions work](../faq#how-does-the-session-sharing-with-shortened-urls-work-in-jbrowse-web)

#### Session spec

Another useful session URL is called a "session spec" or "session specification"

This looks like

```
http://localhost:3000/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type": "LinearGenomeView","tracks":["gff3tabix_genes","volvox_filtered_vcf","volvox_microarray","volvox_cram"]}]}
```

As you can see from the URL, you supply an array of views (so you can open
multiple views at once) and can specify the loc, tracks, assembly, and view
type, or other view specific parameters (different view types may accept
different params, e.g. dotplot has two assemblies)

Here is a session spec for a Circular Genome View

```
http://localhost:3000/?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-5100","type": "CircularView","tracks":["volvox_sv_test"]}]}
```

#### JSON sessions

Similar to encoded sessions, but more readable, JSON session let you specify
the input a JSON snapshot of a session session. This is slightly different from
a session spec, which has extra logic that loads the session. JSON sessions are
literal session snapshots, like those that might come from the "Export
session..." process

Example

```
&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
```

This loads a session with an extra plugin loaded

#### Encoded sessions

This is similar to JSON sessions but uses a URL encoding (base64+gzip)

Example

```
https://jbrowse.org/code/jb2/v1.5.9/?session=encoded-eJyNU2FzmkAQ_SvOfaaNIKDyLbFN0xlrTWRqnU4mc8ACm8BB7k6NdfjvXcCiZpq23-Dt2923u-_2DCPmsevHMn0ePT2umMEEz4GgGWx7C1AKC9EzzQv7wupbpkGfntX3HKt3-YW4OZcJCub1DRZJvgW5xEinzBuMbINtELaKeT_2bY98E0ym_PvdR8rTu7LuMUUBXH4CUeTwjdgUKeJYgZ6_MM-yLWtsGiwo5yBrwBkO3w9dx3b7I3fsuI5FTVGVGd9BdAcJCW27SYhn7QxDKqg0l7pRCIJkmM7YHIxcd2AQbwNSAYExzxQYjCsFeZDtDtlpYo5ZdU9qJQ-fTiZxxrPVYGrf-sdJroHrtQS_ZhIaFiLGZC25JlUUFmGAD0kcPzQ1O90nNQe72dU0eC716vV6rrjC8EObQLEUMElpINu0_tHn3R_yq_t6oBQjuAEegexmP0JfaSv16bpQM_4CMgh1If1WWooguQxTDHnGDpQpDyCjkVhBFTJeliiS-gBpsZ2A0CBrPV3VBt7pIuAiUgvQumZ7Wq6hVrjFKAFNxfZnrfxTKXWw2d3bjG6VN29Rlk2j5mQZaW7ssK8MFmNGin14oVUz1pr5zMQVkXiocQPL_9L6l1jVHFLQD13xsyDHihBqb9AiVPsE_d8WPEKTLuUcv2xdjK8qzLM1PdUDlqPAHH-eeL99vvNC4cFKsrFZ9QuCGmjL
```

Note that the "Share" button has a gear icon that let's you select "Long URL"
that produces these URLs. The encoded share links can be used without the
central session sharing system in place, as the entire session is encoded in
the URL.
