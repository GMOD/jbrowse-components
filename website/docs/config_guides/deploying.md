---
title: Deploying JBrowse Web
description:
  Serving JBrowse Web as a static site, the server settings that make it load
  fast, and scripting its config in a CI/CD pipeline
guide_category: Deployment
---

JBrowse Web is a static site (HTML/JS/CSS plus `config.json`), served from any
static host. Script the config generation so `trackId`s stay stable and share
links stay [reproducible](/docs/urlparams#are-share-links-reproducible) across
rebuilds.

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
[MultiQuantitativeTrack](/docs/config_guides/quantitative_track#many-signals-in-one-track)
whose `subadapters` come from the same rows.

## Keep trackIds stable for reproducible links

A restored session looks each track up by `trackId`, so a pipeline that
regenerates `config.json` with a different id each build (a timestamp, a random
suffix) breaks every link shared before. Derive each `trackId` from stable
inputs, as the script above does from the assembly and sample name. Changing or
deleting an id breaks any saved session that references it, and the whole
session fails to load.

## Server settings that make JBrowse load faster

JBrowse Web loads as dozens of small script files fetched in several rounds, and
the load time goes mostly to waiting on the server between rounds. Two server
settings cut most of those waits: letting browsers keep the scripts, and serving
over HTTP/2.

### Let browsers keep the scripts

Every file under `static/` carries a hash of its contents in its name
(`static/js/7889.f7e060b7.chunk.js`), so a name never comes to mean different
bytes. Browsers can keep those files for a year without asking again. The two
files that do change in place, `index.html` and `config.json`, should be checked
on every visit, so a new release or a config edit shows up at once:

| Path                        | `Cache-Control`                       |
| --------------------------- | ------------------------------------- |
| `static/*`                  | `public, max-age=31536000, immutable` |
| `index.html`, `config.json` | `no-cache`                            |

Without a `Cache-Control` header the browser guesses how long each file stays
fresh from how old it is. Right after a deploy the guess is short, so every
visit asks the server about every script again, one round trip each, and the
data worker asks again for files the page has just fetched.

`no-cache` also replaces the
[cache-buster](/docs/config_guides/avoiding_stale_config) for a server that
caches `config.json` too long. The cache-buster also adds a random query string
to every runtime plugin loaded without an integrity hash, so each visit
downloads those plugins again, where `no-cache` costs one short request that the
server answers with `304 Not Modified`.

Nginx, for JBrowse at the site root:

```nginx
location /static/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location ~ (^/$|index\.html$|config\.json$) {
    add_header Cache-Control "no-cache";
}
```

An `add_header` inside a `location` replaces every `add_header` from the
enclosing `server` block, so repeat any CORS headers there.

Apache 2.4 with `mod_headers`, in the virtual host or an `.htaccess` next to
`index.html`:

```apache
<If "%{REQUEST_URI} =~ m#/static/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
</If>
<FilesMatch "^(index\.html|config\.json)$">
    Header set Cache-Control "no-cache"
</FilesMatch>
```

Caddy:

```text
@static path /static/*
header @static Cache-Control "public, max-age=31536000, immutable"
@entry path / /index.html /config.json
header @entry Cache-Control "no-cache"
```

S3, with or without CloudFront in front. Upload `index.html` last, so no visitor
gets a page naming scripts that are not there yet:

```bash
aws s3 sync static s3://my-bucket/jbrowse/static \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync . s3://my-bucket/jbrowse \
  --exclude "static/*" --exclude index.html --exclude config.json
aws s3 cp config.json s3://my-bucket/jbrowse/ --cache-control no-cache
aws s3 cp index.html s3://my-bucket/jbrowse/ --cache-control no-cache
```

Netlify and Cloudflare Pages read a `_headers` file at the site root:

```text
/static/*
  Cache-Control: public, max-age=31536000, immutable
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/config.json
  Cache-Control: no-cache
```

GitHub Pages sends `max-age=600` on everything and does not let a site change
it.

To check, reload the page with dev tools' Network tab open: the scripts should
show "(memory cache)" or "(disk cache)" and `index.html` a `304`.

### Serve over HTTP/2

Over HTTP/1.1 a browser opens at most six connections to a host, so a round of
dozens of scripts waits in line. HTTP/2 sends them together over one connection.
CDNs and managed hosts use it already. Browsers only speak HTTP/2 over HTTPS, so
it needs a certificate. Nginx 1.25.1 and later:

```nginx
listen 443 ssl;
http2 on;
```

Older Nginx takes `listen 443 ssl http2;`. Apache needs `mod_http2` and:

```apache
Protocols h2 http/1.1
```

### Compress the app, never the data

The
[gzip settings](/docs/config_guides/serving_data#configure-gzip-for-text-never-for-bgzf)
for text apply to the app's scripts too. Brotli, where the server or CDN offers
it, is smaller still: on jbrowse.org it took `main.js` from 111 to 103 KB and
the hg38 hub's 2.1 MB `config.json` from 419 to 367 KB. On CloudFront it is a
checkbox in the cache policy. A distribution still on legacy cache settings has
no policy and serves gzip only; move it to a cache policy that keys on the same
query strings and headers, and tick Brotli there. Keep both off BGZF data files,
for the reasons on that page.

## Cache-busting in index.html

On a host that cannot set `Cache-Control` on `config.json`, the
[cache-buster](/docs/config_guides/avoiding_stale_config) is a one-line
`<script>` in `index.html` for a build script to inject. `config.json` is
fetched before it can configure anything, so the setting has to live in
`index.html`.

## See also

- [Intro to the config.json format](/docs/config_guides/intro)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/avoiding_stale_config)
- [`@jbrowse/cli` command reference](/docs/cli)
- [URL query param API](/docs/urlparams)
