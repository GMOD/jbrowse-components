---
title: Deploying JBrowse Web
description:
  Serving JBrowse Web as a static site, and scripting its config in a CI/CD
  pipeline
guide_category: Deployment
---

**TL;DR:** JBrowse Web is a static site (HTML/JS/CSS plus `config.json`), served
from any static host. Script the config generation so `trackId`s stay stable and
share links stay [reproducible](/docs/faq/#are-my-share-links-reproducible)
across rebuilds.

JBrowse Web is a **static web application**, a folder of HTML, JS, and CSS plus
your `config.json`. There is no JBrowse-specific server: any static file host
(Nginx, Apache, S3, GitHub Pages, a Docker image behind an ingress) can serve
it. Data files (BAM, BigWig, VCF, ...) are read directly from wherever they live
via HTTP range requests, so the only server-side requirement is that your data
host supports range requests and CORS (see
[the CORS FAQ](/docs/faq/#why-do-i-get-a-cors-error-when-loading-remote-files)).

## The minimal deployment

```bash
# 1. lay down the static app into a folder
npx @jbrowse/cli create jbrowse-web

# 2. add an assembly and tracks (writes config.json for you)
cd jbrowse-web
npx @jbrowse/cli add-assembly https://example.com/hg38.fa.gz --name hg38
npx @jbrowse/cli add-track https://example.com/sample.bam --trackId ngs-reads --name "NGS reads" --assemblyNames hg38

# 3. serve the folder with any static host
npx serve .         # or copy it into your Nginx image
```

`jbrowse add-track` just writes a JSON entry into the `tracks` array of
`config.json`, so you never hand-edit it, and you can do the same from a script
(next section).

Docker/Kubernetes are usually overkill for JBrowse itself, since it is just
static files. They make sense if you are bundling JBrowse alongside other
server-side code you operate. The static folder above drops into whatever image
or bucket your pipeline already uses.

## Generating config.json from a script

For repetitive data, **generate** `config.json` rather than maintain it by hand.
A track is just an object in the `tracks` array, so any language that can write
JSON works. For example, turning a samplesheet into a config:

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

`config.base.json` holds everything that isn't per-sample (your `assemblies`
array and any global settings); the script merges in the generated `tracks`.

For a set of signals that belong together (e.g. an RNA-seq timecourse in
triplicate), emit a single
[MultiQuantitativeTrack](/docs/config_guides/multiquantitative_track) whose
`subadapters` array is built from the same rows. See that guide for a templated
`subadapters` example.

This is also where tools like [Jsonnet](https://jsonnet.org/) fit well, if you
prefer a templating language to a script. JBrowse does not require Jsonnet (the
output is still ordinary `config.json`), but it can be a clean way to express
repeated track shapes.

## Keep trackIds stable for reproducible links

When a shared session is restored, JBrowse looks up each track by its `trackId`.
If your pipeline regenerates `config.json` with **different** `trackId`s each
build (an ID embedding a timestamp or random suffix), previously shared links
fail to restore those tracks. Derive each `trackId` deterministically from
stable inputs, as in the script above, where the ID comes from the assembly and
sample name rather than anything that changes per build. See
[why a saved session fails to load](/docs/faq/#why-does-my-saved-session-fail-to-load).

## The one thing that lives in index.html: cache-busting

Assemblies, tracks, plugins, and the default session are all `config.json`, so
all of it can be scripted. The one exception is the
[cache-buster](/docs/config_guides/avoiding_stale_config), a one-line
`<script>`, which has to be in `index.html` because `config.json` is fetched
before it can configure anything.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams)
