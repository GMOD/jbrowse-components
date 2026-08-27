---
title: FAQ
description:
  Common questions about running, configuring, and troubleshooting JBrowse 2
---

Short answers, each pointing at the page that covers it properly. If something
is broken rather than unclear, start at [](/docs/troubleshooting).

## General

### What is the difference between JBrowse Web and JBrowse Desktop

JBrowse Web is a static web app you deploy to a server, so anyone with the URL
can use it. [JBrowse Desktop](/docs/quickstart_desktop) is an Electron app that
runs locally, opens local files directly, and needs no server.

### What browsers does JBrowse 2 support

Recent versions of Chrome, Firefox, Safari and Edge. Most development and
testing happens in Chrome.

### What file formats can JBrowse 2 read

BAM, CRAM, VCF, GFF3, BED, bigWig, bigBed, PAF, MAF, `.hic`, and many others.
[](/docs/config_guides/file_types)

### Does JBrowse 2 send my data anywhere

No. Your browser reads your data files directly from wherever they are hosted,
so reads, variants and annotations never pass through a JBrowse server, and
JBrowse Desktop works entirely offline. The two things that do use the network
are a [usage report](/docs/config_guides/disable_analytics), which names no
files and can be turned off, and the Share button, which
[encrypts the session in your browser first](/docs/urlparams#sessionshare-).

### Can I open files from my own computer

[JBrowse Desktop](/docs/quickstart_desktop) opens them through its file picker
and keeps the paths in the session. JBrowse Web can open one for the life of a
tab only — browsers do not let a page re-open a path on disk later, so the track
is gone after a reload and cannot travel in a share link.

### How do I make an image for a publication

Every genome view has an "Export SVG" option that writes exactly what is on
screen, ready for Illustrator or Inkscape. To regenerate figures as the data
changes, [@jbrowse/img](/docs/jbrowse-img) renders from the command line, and
[](/docs/automating#headless--puppeteer) drives the running app for a screenshot
of a menu or an interaction.

### How do I cite JBrowse 2

Diesh, C., Stevens, G.J., Xie, P. _et al._ JBrowse 2: a modular genome browser
with views of synteny and structural variation. _Genome Biology_ 24, 74 (2023).
[https://doi.org/10.1186/s13059-023-02914-z](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02914-z)

### What license is JBrowse 2 released under

[Apache License 2.0](https://github.com/GMOD/jbrowse-components/blob/main/LICENSE),
free for both academic and commercial use.

## Setup

### How can I setup JBrowse 2 on my web server

[](/docs/quickstart_web) has the walkthrough. With the CLI installed it is one
command to install and one to update later:

```bash
jbrowse create /var/www/html/jb2     # download the app into that folder
jbrowse upgrade /var/www/html/jb2    # replace the app files with the latest release
```

The release contains no config.json, so `upgrade` leaves yours in place.

### How do I install or update the @jbrowse/cli tool

`npm install -g @jbrowse/cli`, and the same command updates it. The CLI only
prepares your config.json — it **does not run server-side code**.
[CLI reference](/docs/cli)

### What does my web server need to do

Serve static files, honor byte-range requests, set no `Content-Encoding` on BGZF
files, and answer CORS if the data lives on another host.
[](/docs/config_guides/serving_data)

### How do I put my data behind a login

JBrowse has no server and no accounts of its own, so whatever serves the files
decides who may read them — leaving a track out of config.json protects nothing,
and a password in config.json is public. [](/docs/config_guides/authentication)

### How do I add an assembly, or load a track

`jbrowse add-assembly hg19.fa.gz -n hg19` and
`jbrowse add-track myfile.bw -a hg19` write the config entries for you, working
out the file type and index. See [](/docs/config_guides/assemblies) and
[](/docs/config_guides/tracks).

### Can I load a UCSC track hub

Yes, as a [connection](/docs/user_guides/connections). To hand someone a link
that opens a hub with no setup at all, use
[`&hubURL=`](/docs/user_guides/hub_url).

### How do I convert my JBrowse 1 configuration to JBrowse 2

A JBrowse 1 connection translates its tracks on connect, leaving the data files
where they are.
[](/docs/config_guides/connections#migrating-a-jbrowse-1-instance)

### How can I make a header on a jbrowse-web instance

Edit the index.html that ships with jbrowse-web to add content outside the `div`
the app renders into. To make the header part of a larger app instead, use
[`@jbrowse/react-app2`](/docs/embedded_components) — jbrowse-web itself is not
published as an npm package.

### How do I add a plugin

List its `name` and bundle `url` in the top-level `plugins` array of
config.json, see [](/docs/config_guides/plugins). The
[plugin store](/plugin_store/) has the snippet for every published plugin, and
the [in-app store](/docs/user_guides/plugin_store) installs one into the current
session without editing config.json.

## Configuration

### How do I change the color of a track

The track menu's **Color** entry picks one and saves it with your session. In
config, set `color` in the track's `displayDefaults`; in a URL, in its
`displaySnapshot`. [](/docs/cookbook#colors)

### How do I color features by an attribute (color callback)

Set `color` to a [Jexl](https://github.com/TomFrost/Jexl) expression instead of
a plain color — `"color": "jexl:feature.strand==-1?'red':'blue'"`. See
[](/docs/config_guides/jexl), and
[](/docs/config_guides/customizing_feature_colors/) for adding a function of
your own when an expression gets unwieldy.

### How do I get (more) categories to filter on in the faceted track selector

It facets on adapter type, category, and every `metadata` key on a track.
[](/docs/config_guides/track_selector)

### How do I open JBrowse at a particular location with certain tracks turned on

For everyone who visits, set a [](/docs/config_guides/default_session). For a
one-off link, [](/docs/urlparams) covers `&assembly=`, `&loc=` and `&tracks=`
through to a whole multi-view session spec, and [](/docs/automating) compares
every way to preset a view.

### Why can't I copy and paste my URL bar to share it with another user

Sessions can outgrow a URL, so JBrowse keeps only the session ID in the bar and
the session itself in sessionStorage/IndexedDB, which another user's browser
does not have. Use the Share button, or build a self-contained link with
[](/docs/urlparams).

### When does JBrowse show "Zoom in to see more features"

When either of two limits would be exceeded — the bytes the fetch would
download, or the features that would land on screen. The banner's **Force load**
button loads the region anyway, and
[](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits) covers
raising each.

## Developers

### How can I start the JBrowse 2 app as a developer

Clone, `pnpm install`, then `pnpm start` in the product you want. Prerequisites
and per-product commands are in
[CONTRIBUTING.md](https://github.com/GMOD/jbrowse-components/blob/main/CONTRIBUTING.md).

### How do I write a plugin

[](/docs/developer_guides/simple_plugin) starts you from an official template
with a working build. For a jexl function or a small config callback,
[](/docs/developer_guides/no_build_plugin) skips the toolchain entirely, and
[](/docs/developer_guide) covers the element types a plugin can register.

### Why doesn't JBrowse 2 render through deck.gl, Pixi or wgpu

[](/docs/developer_guides/why_not_x)

### Should I use an embedded component or the full app

[](/docs/embedded_components#embedded-views-versus-the-full-app)
