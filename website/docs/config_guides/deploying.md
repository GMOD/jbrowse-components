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
ingress) serves the folder, and the data files are read from wherever they live
over HTTP range requests, so the only server-side requirement is on the data
host ([](/docs/config_guides/serving_data)).

## The minimal deployment

```bash
npx @jbrowse/cli create jbrowse-web
cd jbrowse-web
npx @jbrowse/cli add-assembly https://example.com/hg38.fa.gz --name hg38
npx @jbrowse/cli add-track https://example.com/sample.bam --trackId ngs-reads --name "NGS reads" --assemblyNames hg38
npx serve .         # or copy the folder into your Nginx image or bucket
```

## Generating config.json from a script

A track is an object in the `tracks` array, so any language that writes JSON can
generate the config from a samplesheet:

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

`config.base.json` holds everything that is not per-sample (`assemblies` and
global settings). Signals that belong together, such as a timecourse in
triplicate, become one
[MultiQuantitativeTrack](/docs/config_guides/multiquantitative_track) whose
`subadapters` come from the same rows.

## Keep trackIds stable for reproducible links

A restored session looks each track up by `trackId`, so a pipeline that
regenerates `config.json` with a different id each build (a timestamp, a random
suffix) breaks every link shared before. Derive each `trackId` from stable
inputs, as the script above does from the assembly and sample name. Changing or
deleting an id breaks any saved session that references it, and the whole
session fails to load.

## Cache-busting in index.html

`config.json` is fetched before it can configure anything, so the
[cache-buster](/docs/config_guides/avoiding_stale_config) is a one-line
`<script>` in `index.html` for a build script to inject.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams)
