---
title: Deploying JBrowse Web
description:
  Serving JBrowse Web as a static site, and scripting its config in a CI/CD
  pipeline
guide_category: Deployment
---

**TL;DR:** JBrowse Web is a static site (HTML/JS/CSS plus `config.json`), served
from any static host. Script the config generation so `trackId`s stay stable and
share links stay [reproducible](/docs/urlparams#are-share-links-reproducible)
across rebuilds.

Any static file host (Nginx, Apache, S3, GitHub Pages, a Docker image behind an
ingress) serves the folder. Data files are read from wherever they live via HTTP
range requests, so the only server-side requirement is that the data host
supports range requests and CORS (see [](/docs/config_guides/serving_data)).

## The minimal deployment

- Lay down the static app into a folder:

  ```bash
  npx @jbrowse/cli create jbrowse-web
  ```

- Add an assembly and tracks, which writes `config.json` for you:

  ```bash
  cd jbrowse-web
  npx @jbrowse/cli add-assembly https://example.com/hg38.fa.gz --name hg38
  npx @jbrowse/cli add-track https://example.com/sample.bam --trackId ngs-reads --name "NGS reads" --assemblyNames hg38
  ```

- Serve the folder with any static host:

  ```bash
  npx serve .         # or copy it into your Nginx image
  ```

`jbrowse add-track` writes a JSON entry into the `tracks` array, and a script
can do the same (next section). The static folder drops into whatever image or
bucket your pipeline already uses.

## Generating config.json from a script

A track is an object in the `tracks` array, so any language that writes JSON can
generate `config.json`. Turning a samplesheet into a config:

```js
// samplesheet rows: { sample, assembly, bigwig }
import { readFileSync, writeFileSync } from 'fs'

const rows = JSON.parse(readFileSync('samplesheet.json', 'utf8'))

const tracks = rows.map(row => ({
  type: 'QuantitativeTrack',
  // a stable, deterministic trackId is the important part, see below
  trackId: `rnaseq-${row.assembly}-${row.sample}`,
  name: `RNA-seq ${row.sample}`,
  assemblyNames: [row.assembly],
  adapter: { type: 'BigWigAdapter', uri: row.bigwig },
}))

const config = JSON.parse(readFileSync('config.base.json', 'utf8'))
writeFileSync('config.json', JSON.stringify({ ...config, tracks }, null, 2))
```

`config.base.json` holds everything that isn't per-sample (`assemblies` and
global settings). For signals that belong together (an RNA-seq timecourse in
triplicate), emit one
[MultiQuantitativeTrack](/docs/config_guides/multiquantitative_track) whose
`subadapters` array is built from the same rows. A templating language like
[Jsonnet](https://jsonnet.org/) works too.

## Keep trackIds stable for reproducible links

A restored session looks up each track by `trackId`. A pipeline that embeds a
timestamp or random suffix in the ID breaks every previously shared link, and
the whole session fails to load rather than just that track. Derive each
`trackId` from stable inputs, as the script above does from the assembly and
sample name.

## Cache-busting in index.html

The [cache-buster](/docs/config_guides/avoiding_stale_config) is a one-line
`<script>` in `index.html`, since `config.json` is fetched before it can
configure anything.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams)
