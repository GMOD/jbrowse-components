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
your `config.json`. Any static file host (Nginx, Apache, S3, GitHub Pages, a
Docker image behind an ingress) can serve it. Data files (BAM, BigWig, VCF, ...)
are read directly from wherever they live via HTTP range requests, so the only
server-side requirement is that your data host supports range requests and CORS
(see
[the CORS FAQ](/docs/faq/#why-do-i-get-a-cors-error-when-loading-remote-files)).

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

`jbrowse add-track` writes a JSON entry into the `tracks` array of
`config.json`, and a script can do the same (next section).

Docker/Kubernetes make sense where you are bundling JBrowse alongside other
server-side code you operate. The static folder above drops into whatever image
or bucket your pipeline already uses.

## Generating config.json from a script

For repetitive data, **generate** `config.json`. A track is an object in the
`tracks` array, so any language that can write JSON works. For example, turning
a samplesheet into a config:

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

Tools like [Jsonnet](https://jsonnet.org/) fit here too, if you prefer a
templating language to a script; the output is still ordinary `config.json`.

## Keep trackIds stable for reproducible links

When a shared session is restored, JBrowse looks up each track by its `trackId`.
If your pipeline regenerates `config.json` with **different** `trackId`s each
build (an ID embedding a timestamp or random suffix), previously shared links
fail to restore those tracks. Derive each `trackId` deterministically from
stable inputs, as in the script above, where the ID comes from the assembly and
sample name. See
[why a saved session fails to load](/docs/faq/#why-does-my-saved-session-fail-to-load).

## Cache-busting in index.html

Assemblies, tracks, plugins, and the default session are all `config.json`, so
all of it can be scripted. The
[cache-buster](/docs/config_guides/avoiding_stale_config) is a one-line
`<script>` in `index.html`, since `config.json` is fetched before it can
configure anything.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams)
