---
title: Deploying JBrowse Web
description:
  Serving JBrowse Web as a static site, and scripting its config in a CI/CD
  pipeline
guide_category: Getting started
---

JBrowse Web is a **static web application** — a folder of HTML, JS, and CSS plus
your `config.json`. There is no JBrowse-specific server: any static file host
(Nginx, Apache, S3, GitHub Pages, a Docker image behind an ingress) can serve
it. Data files (BAM, BigWig, VCF, ...) are read directly from wherever they live
via HTTP range requests, so the only server-side requirement is that your data
host supports range requests and CORS (see
[the CORS FAQ](/docs/faq/#why-do-i-get-a-cors-error-when-loading-remote-files)).

This page shows how to script a deployment end-to-end, which is the key to
getting **reproducible share links** across rebuilt images (see
[reproducible share links](/docs/faq/#are-my-share-links-reproducible)).

## The minimal deployment

```bash
# 1. lay down the static app into a folder
npx @jbrowse/cli create jbrowse-web

# 2. add an assembly and tracks (writes config.json for you)
cd jbrowse-web
jbrowse add-assembly https://example.com/hg38.fa.gz --name hg38 --load inPlace
jbrowse add-track https://example.com/sample.bam --trackId ngs-reads --name "NGS reads" --assemblyNames hg38

# 3. serve the folder with any static host
npx serve .         # or copy it into your Nginx image
```

Everything `jbrowse add-track` does is write a JSON entry into the `tracks`
array of `config.json` — so you never have to hand-edit `config.json`, and you
can do the same thing yourself from a script (next section).

:::info

Docker/Kubernetes are usually overkill for JBrowse itself, since it is just
static files. They make sense if you are bundling JBrowse alongside other
server-side code you operate. The static folder above is all JBrowse needs —
copy it into whatever image or bucket your pipeline already uses.

:::

## Generating config.json from a script

`config.json` is plain JSON, so for repetitive data the most reliable approach
is to **generate it** rather than maintain it by hand. A track is just an object
in the `tracks` array, so any language that can write JSON works. For example,
turning a samplesheet into a config:

```js
// samplesheet rows: { sample, assembly, bigwig }
import { readFileSync, writeFileSync } from 'fs'

const rows = JSON.parse(readFileSync('samplesheet.json', 'utf8'))

const tracks = rows.map(row => ({
  type: 'QuantitativeTrack',
  // a stable, deterministic trackId is the important part — see below
  trackId: `rnaseq-${row.assembly}-${row.sample}`,
  name: `RNA-seq ${row.sample}`,
  assemblyNames: [row.assembly],
  adapter: { type: 'BigWigAdapter', uri: row.bigwig },
}))

const config = JSON.parse(readFileSync('config.base.json', 'utf8'))
writeFileSync('config.json', JSON.stringify({ ...config, tracks }, null, 2))
```

For a set of signals that belong together (e.g. an RNA-seq timecourse in
triplicate), emit a single
[MultiQuantitativeTrack](/docs/config_guides/multiquantitative_track) whose
`subadapters` array is built from the same rows — see that guide for a templated
`subadapters` example.

:::info

This is also where tools like [Jsonnet](https://jsonnet.org/) fit well, if you
prefer a templating language to a script. JBrowse does not require Jsonnet — the
output is still ordinary `config.json` — but it can be a clean way to express
repeated track shapes.

:::

## Keep trackIds stable for reproducible links

When a shared session is restored, JBrowse looks up each track by its `trackId`.
If your pipeline regenerates `config.json` with **different** `trackId`s each
build (e.g. an ID that embeds a timestamp or a random suffix), previously shared
links will fail to restore those tracks. The fix is to derive each `trackId`
deterministically from stable inputs — as in the script above, where the ID is
built from the assembly and sample name, not from anything that changes per
build. With stable IDs, the same view always serializes to the same session
JSON. See
[why a saved session fails to load](/docs/faq/#why-does-my-saved-session-fail-to-load).

## The one thing that lives in index.html: cache-busting

Because `config.json` is fetched _before_ it can configure anything, the only
piece of deploy config that genuinely has to live in `index.html` is the
[cache-buster](/docs/config_guides/avoiding_stale_config). It is a one-line
snippet, so it is easy to inject from your build rather than hand-edit. Beyond
that and any plugin `<script>` tags (see
[plugins](/docs/config_guides/plugins)), the rest of your setup — assemblies,
tracks, default session — is all `config.json` and can be fully scripted.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [Avoiding stale config](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams) — linking to specific locations/tracks
