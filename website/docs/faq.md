---
title: FAQ
description:
  Common questions about running, configuring, and troubleshooting JBrowse 2
---

Short answers, each pointing at the page that covers it properly. If something
is broken rather than unclear, start at [](/docs/troubleshooting).

## General

### What is special about JBrowse 2

JBrowse 2's plugin system supports custom view types (e.g. circular, dotplot)
alongside the built-in ones, making it a platform for genomic visualization. The
[gallery](/gallery/) shows what that looks like in practice, and each figure
there opens live in the app. The [features page](/features/) is the overview:
multi-assembly comparison, synteny and dotplot views, a circular genome view,
Hi-C display, and an SV inspector.

### What is the difference between JBrowse Web and JBrowse Desktop

JBrowse Web is a static web app you deploy to a server, so anyone with the URL
can use it. [JBrowse Desktop](/docs/quickstart_desktop) is an Electron app that
runs locally, opens local files directly, and needs no server.

### What browsers does JBrowse 2 support

Recent versions of Chrome, Firefox, Safari and Edge. Most development and
testing happens in Chrome. Tracks are drawn on the graphics card where the
browser provides it (WebGPU first, then WebGL2) and fall back to 2D canvas
drawing where it does not, so a machine without a usable GPU still works.

### What file formats can JBrowse 2 read

BAM, CRAM, VCF, GFF3, BED, bigWig, bigBed, PAF, MAF, `.hic`, and many others.
[](/docs/config_guides/file_types) maps each format to its adapter and a config
snippet.

### Does JBrowse 2 send my data anywhere

No. Your browser reads your data files directly from wherever they are hosted,
so reads, variants and annotations never pass through a JBrowse server. JBrowse
Desktop works entirely offline against local files.

Two things do use the network:

- **A usage report**, sent on load by JBrowse Web and JBrowse Desktop: the
  JBrowse version, counts of tracks, assemblies and open views, track type
  names, plugin names, screen size, and which renderer was selected. No file
  URLs, track names or data are included, and
  [`disableAnalytics: true`](/docs/config_guides/disable_analytics) turns it off
  entirely (the embedded components never report anything).
- **The Share button**, which uploads a session
  [encrypted in your browser before it is sent](/docs/urlparams#sessionshare-).

### Can I open files from my own computer

[JBrowse Desktop](/docs/quickstart_desktop) opens local files through its file
picker and stores their paths in the session. JBrowse Web can open a local file
too, but only for the life of that tab: browsers do not let a page re-open a
path on disk later, so such a track is gone after a reload and cannot travel in
a share link.

### How do I make an image for a publication

The genome views (linear, circular, dotplot, synteny, breakpoint split) each
have an "Export SVG" option that writes a vector file of exactly what is on
screen, ready to edit in Illustrator or Inkscape. To regenerate figures as the
data changes, [@jbrowse/img](/docs/jbrowse-img) renders a view to SVG or PNG
from the command line, and [](/docs/automating#headless--puppeteer) drives the
running app for a screenshot of a menu, popover or interaction.

### How do I cite JBrowse 2

Diesh, C., Stevens, G.J., Xie, P. _et al._ JBrowse 2: a modular genome browser
with views of synteny and structural variation. _Genome Biology_ 24, 74 (2023).
[https://doi.org/10.1186/s13059-023-02914-z](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02914-z)

### What license is JBrowse 2 released under

Open source under the
[Apache License 2.0](https://github.com/GMOD/jbrowse-components/blob/main/LICENSE),
free for both academic and commercial use.

## Setup

### How can I setup JBrowse 2 on my web server

[](/docs/quickstart_web) has the full walkthrough. With the CLI installed it is
one command to install and one to update later:

```bash
jbrowse create /var/www/html/jb2     # download the app into that folder
jbrowse upgrade /var/www/html/jb2    # replace the app files with the latest release
```

The release contains no config.json, so `upgrade` leaves yours in place. The CLI
is optional — you can unzip a
[release](https://github.com/GMOD/jbrowse-components/releases) and edit
`config.json` by hand. See [](/docs/config_guides/intro) for the shape of the
file and [](/docs/cookbook) for a minimal config to start from.

### How do I install or update the @jbrowse/cli tool

`npm install -g @jbrowse/cli`; re-running the same command updates it. The CLI
only prepares your config.json, it **does not run server-side code**. Every
command and flag is in the [CLI reference](/docs/cli).

### What does my web server need to do

Serve static files and honor byte-range requests, with no `Content-Encoding` on
BGZF files and a CORS policy if the data lives on another host.
[](/docs/config_guides/serving_data) covers all of it, and
[](/docs/config_guides/deploying) covers what a production instance wants
besides.

### How do I put my data behind a login

JBrowse has no server and no user accounts of its own, so whatever serves the
files decides who may read them. Leaving a track out of config.json does not
protect it, and a password in config.json is public.
[](/docs/config_guides/authentication) covers the usual answer (app and data on
one origin, behind the login your site already has) and the fallbacks.

### How do I add an assembly, or load a track

`jbrowse add-assembly hg19.fa.gz -n hg19` and
`jbrowse add-track myfile.bw -a hg19` write the config entries for you, working
out the file type and index. See [](/docs/config_guides/assemblies),
[](/docs/config_guides/tracks), and the [CLI reference](/docs/cli). On JBrowse
Desktop the "Open assembly" dialog does the same thing, and any instance can add
a track from inside the app.

### Can I load a UCSC track hub

Yes. Add the hub's `hub.txt` URL as a connection and its assemblies and tracks
become available, see [](/docs/user_guides/connections). To hand someone a link
that opens a hub with no setup at all, use
[`&hubURL=`](/docs/user_guides/hub_url).

### How do I convert my JBrowse 1 configuration to JBrowse 2

Point a JBrowse 1 connection at the data directory and its tracks are translated
on connect, leaving the data files where they are. See
[migrating a JBrowse 1 instance](/docs/config_guides/connections#migrating-a-jbrowse-1-instance).

### How can I make a header on a jbrowse-web instance

Edit the index.html that ships with jbrowse-web to add content outside the `div`
the app renders into. To make the header part of a larger app instead, use
[`@jbrowse/react-app2`](/docs/embedded_components), which is the whole JBrowse
app as a React component you control the page around. jbrowse-web itself is not
published as an npm package.

### How do I add a plugin

List the plugin's `name` and bundle `url` in the top-level `plugins` array of
config.json, see [](/docs/config_guides/plugins). The
[plugin store page](/plugin_store/) has the snippet for every published plugin,
and the [in-app plugin store](/docs/user_guides/plugin_store) can install one
into the current session without editing config.json.

## Configuration

### How do I change the color of a track

In the app, the track menu's **Color** entry picks a solid color and saves it
with your session. In the config, set `color` in the track's `displayDefaults`;
in a URL, set it in the track's `displaySnapshot`
([example](/docs/urlparams#live-example-feature-track-color)). The
[cookbook's colors section](/docs/cookbook#colors) has copy-paste versions per
track type.

### How do I color features by an attribute (color callback)

Set `color` to a [Jexl](https://github.com/TomFrost/Jexl) expression instead of
a plain color — `"color": "jexl:feature.strand==-1?'red':'blue'"` — from the
config, the URL, or the track's configuration editor. See
[](/docs/config_guides/jexl) for the full reference,
[more ways to set color](/docs/cookbook#more-ways-to-set-color) for worked
examples, and [](/docs/config_guides/customizing_feature_colors/) for adding a
jexl function of your own when an expression gets unwieldy.

### How do I get (more) categories to filter on in the faceted track selector

The selector facets on adapter type, category, and every `metadata` key on a
track. [](/docs/config_guides/track_selector)

### How do I open JBrowse at a particular location with certain tracks turned on

For everyone who visits, set a [](/docs/config_guides/default_session) in
config.json. For a one-off link, the [URL parameters](/docs/urlparams)
`&assembly=`, `&loc=` and `&tracks=` cover the common case, and a session spec
can describe a whole multi-view state. [](/docs/automating) compares all the
ways to preset a view.

### Why can't I copy and paste my URL bar to share it with another user

Sessions can grow too large to fit in a URL, so JBrowse keeps only the session
ID in the URL bar and the session itself in sessionStorage/IndexedDB, which
another user's browser does not have. Use the Share button, or build a
self-contained link yourself with [](/docs/urlparams).

### Why do some of my reads not display soft-clipping

Some reads, such as secondary reads, do not have a `SEQ` field on their records,
so they will not display soft-clipping. The soft-clipping indicators on these
reads appear black.

### Why do all the tracks need an assembly specified

JBrowse 2 is a multi-genome-assembly browser that can compare genomes side by
side, so every track must declare which assembly it belongs to. This differs
from JBrowse 1, which operated on a single assembly at a time.

### How are the menus structured in the app

The top-level menu performs only global operations. Each view has its own menu
and each track has its own track menu, because a session can hold many views at
once. In JBrowse 1 the app menu operated directly on the single view.

### When does JBrowse show "Zoom in to see more features"

Two limits guard the region — the bytes the fetch would download, and the
features that would land on screen — and either one shows the message. See
[the region limits](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits)
for raising each, and the banner's **Force load** button for loading a region
once without touching the config.

## Developers

### How can I start the JBrowse 2 app as a developer

You need a recent [node](https://nodejs.org/en/), git, and
[pnpm](https://pnpm.io/installation).

```bash
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
pnpm install
cd products/jbrowse-web
pnpm start
```

The dev server comes up on port 3000, and `PORT=8080 pnpm start` picks another.
JBrowse Desktop is the same sequence from `products/jbrowse-desktop`.

For an embedded component, run `pnpm dev` in its `examples-site` subfolder (e.g.
`products/jbrowse-react-linear-genome-view/examples-site`). The source folders
under `products/` drop the trailing `2` that the published packages carry:
`@jbrowse/react-linear-genome-view2`, `@jbrowse/react-app2`,
`@jbrowse/react-circular-genome-view2`.

### How do I write a plugin

The [writing a plugin guide](/docs/developer_guides/simple_plugin) starts you
from an official template with a working build. If all you need is a jexl
function or a small config callback, the
[no-build plugin guide](/docs/developer_guides/no_build_plugin) skips the
toolchain entirely. The [developer guide index](/docs/developer_guide) covers
the pluggable element types a plugin can register.

### What technologies does JBrowse 2 use

React, [@jbrowse/mobx-state-tree](https://github.com/GMOD/mobx-state-tree),
web-workers, TypeScript, WebGPU with WebGL2 and Canvas2D fallbacks for track
rendering, and Electron for desktop. For orientation on the first two, see this
[short guide](https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f).

### Why doesn't JBrowse 2 render through deck.gl, Pixi or wgpu

[](/docs/developer_guides/why_not_x)

### Should I use an embedded component or the full app

[](/docs/embedded_components#embedded-views-versus-the-full-app)
