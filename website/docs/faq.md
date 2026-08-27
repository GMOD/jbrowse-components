---
title: FAQ
description:
  Common questions about running, configuring, and troubleshooting JBrowse 2
---

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

### Do you have any tips for learning React and @jbrowse/mobx-state-tree

See this
[short orientation guide](https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f).

### What technologies does JBrowse 2 use

Key technologies include:

- React
- @jbrowse/mobx-state-tree
- web-workers
- Typescript
- WebGPU, with WebGL2 and Canvas2D fallbacks, for track rendering
- Electron (for desktop specifically)

### Why doesn't JBrowse 2 render through deck.gl, Pixi or wgpu

SVG export re-runs a display's own draw function rather than its shader, so a
display that draws to a canvas needs a Canvas2D path, and none of those
libraries has one. [](/docs/developer_guides/why_not_x) covers each candidate,
and why the hot loops are TypeScript while the decompression kernel is Rust.

### How do I write a plugin

The [writing a plugin guide](/docs/developer_guides/simple_plugin) starts you
from an official template with a working build. If all you need is a jexl
function or a small config callback, the
[no-build plugin guide](/docs/developer_guides/no_build_plugin) skips the
toolchain entirely.

The [developer guide index](/docs/developer_guide) covers the pluggable element
types a plugin can register (adapters, displays, views, widgets) and
[testing plugins](/docs/developer_guides/testing_plugins).

## General

### What is special about JBrowse 2

JBrowse 2's plugin system supports custom view types (e.g. circular, dotplot)
alongside the built-in ones, making it a platform for genomic visualization. The
[gallery](/gallery/) shows what that looks like in practice, and each figure
there opens live in the app.

### What is the difference between JBrowse Web and JBrowse Desktop

JBrowse Web is a static web app you deploy to a server, so anyone with the URL
can use it. JBrowse Desktop is an Electron app that runs locally on a user's
machine, can open local files directly, and does not require a server.

### What browsers does JBrowse 2 support

Recent versions of Chrome, Firefox, Safari and Edge. Most development and
testing happens in Chrome.

Tracks are drawn on the graphics card where the browser provides it (WebGPU
first, then WebGL2) and fall back to 2D canvas drawing where it does not, so a
machine without a usable GPU still works. See
[my tracks are blank or render incorrectly](#my-tracks-are-blank-or-render-incorrectly)
if something looks wrong.

### What file formats can JBrowse 2 read

BAM, CRAM, VCF, GFF3, BED, bigWig, bigBed, PAF, MAF, `.hic`, and many others.
The [supported file types](/docs/config_guides/file_types) page maps each format
to its adapter and a config snippet.

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
  [encrypted in your browser before it is sent](#how-does-session-sharing-with-shortened-urls-work-in-jbrowse-web).

### How do I make an image for a publication

The genome views (linear, circular, dotplot, synteny, breakpoint split) each
have an "Export SVG" option that writes a vector file of exactly what is on
screen, ready to edit in Illustrator or Inkscape. For figures you want to
regenerate as the data changes, [@jbrowse/img](/docs/jbrowse-img) renders a view
to SVG or PNG from the command line.

### How do I automatically create screenshots

[@jbrowse/img](/docs/jbrowse-img) covers the rendered view, with no browser
involved. For a screenshot of the running app - an open menu, a hover popover, a
track after some interaction - drive JBrowse Web with puppeteer or Playwright:
navigate to a URL that already carries the state you want (see
[URL parameters](/docs/urlparams)), wait for it to settle, then capture.
[](/docs/automating#headless--puppeteer) has a worked example along with the two
things that usually go wrong: headless Chrome needs
`--enable-unsafe-swiftshader` before GPU-rendered tracks appear, and a capture
taken before the displays report done comes out blank.

Nearly every figure on this site is generated that way, from a declarative spec
per image in
[`website/scripts/screenshot-specs.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/screenshot-specs.ts),
so the specs double as worked examples.

### What are new features in JBrowse 2

See the [features page](/features/) for a full overview. Highlights include
multi-assembly comparison, synteny/dotplot views, a circular genome view, Hi-C
display, and an SV inspector.

### How do I convert my JBrowse 1 configuration to JBrowse 2

There is no official migration tool - the config formats differ enough that you
generally set the tracks up fresh with the CLI or the GUI. A community script
like
[this gist](https://gist.github.com/cmdcolin/2ef875fc19c5f164aad41bd330f1bb37)
can extract track definitions from a JBrowse 1 config to work from.

As a temporary bridge, the built-in **JBrowse 1 connection** reads a running
JBrowse 1 data directory's `trackList.json`, so you can browse those tracks
without migrating. It is limited in what it supports.

### How do I cite JBrowse 2

Please cite our paper:

Diesh, C., Stevens, G.J., Xie, P. _et al._ JBrowse 2: a modular genome browser
with views of synteny and structural variation. _Genome Biology_ 24, 74 (2023).
[https://doi.org/10.1186/s13059-023-02914-z](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02914-z)

### What license is JBrowse 2 released under

JBrowse 2 is open source under the
[Apache License 2.0](https://github.com/GMOD/jbrowse-components/blob/main/LICENSE).
It is free for both academic and commercial use.

## Setup

### How can I setup JBrowse 2 on my web server

The [quickstart web](/docs/quickstart_web) guide has the full walkthrough. With
the CLI installed it is one command to install and one to update later:

```bash
jbrowse create /var/www/html/jb2     # download the app into that folder
jbrowse upgrade /var/www/html/jb2    # replace the app files with the latest release
```

The release contains no config.json, so `upgrade` leaves yours in place.

The CLI is optional. `add-track` works out the track type, finds the index and
writes the config entry for you. Without it, download a zip from the
[releases page](https://github.com/GMOD/jbrowse-components/releases), unzip it
into your web directory, and edit `config.json` in a text editor. See
[config basics](/docs/config_guides/intro) for the shape of the file, the
[cookbook](/docs/cookbook) for a complete minimal config to start from, and the
[config guide](/docs/config_guide) for everything you can put in it.

### How do I install or update the @jbrowse/cli tool

Install with `npm install -g @jbrowse/cli`; re-running the same command updates
it. That adds a `jbrowse` command to your PATH (assuming a standard Node.js
install via nodesource or nvm). The CLI only prepares your config.json, it
**does not run server-side code**. Every command and flag is in the
[CLI reference](/docs/cli).

### What web server do I need to run JBrowse 2

JBrowse 2 is just static JS/CSS/HTML, no backend required. Deploy by copying the
folder to your web server (e.g. `/var/www/html/`) or Amazon S3.

If you use Django, put jbrowse-web in the static resources folder, but serve
data files from a separate server (Django's static resources folder won't serve
them correctly). For some informal troubleshooting notes, see
[these notes](https://github.com/cmdcolin/django-jbrowse2-nonworking-example).

The server you use should support byte-range requests (e.g. the
[Range HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range))
so that JBrowse can get small slices of large binary data files.

The [deployment guide](/docs/config_guides/deploying) covers the rest of what a
production instance wants: generating config.json from a script, keeping
`trackId`s stable so share links survive a redeploy, and cache-busting
index.html.

### Should I configure gzip on my web server

Yes. JBrowse Web is roughly 2MB of JavaScript, which gzip cuts to about a third
of that, and the same setting shrinks `config.json` (a config with hundreds of
tracks is mostly repeated JSON keys). Most cloud hosts, including AWS
CloudFront, Amplify and Netlify, compress text responses automatically. Apache
and Nginx have to be told.

For Nginx, add to your server block:

```nginx
gzip on;
gzip_types application/json text/plain text/html text/css text/javascript application/javascript;
```

For Apache, enable `mod_deflate`:

```bash
sudo a2enmod deflate
sudo systemctl restart apache2
```

Then add to your Apache config (e.g.
`/etc/apache2/sites-available/000-default.conf`):

```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

This applies to text only. Never gzip BGZF binary files, see
[BAM (or other indexed binary files) do not work on my server](#bam-or-other-indexed-binary-files-do-not-work-on-my-server).

### BAM (or other indexed binary files) do not work on my server

Almost always: the server is sending `Content-Encoding: gzip` on a
BGZF-compressed file (BAM, VCF.gz, GFF.gz, BED.gz, .fa.gz, etc.).

BGZF looks like gzip to the server, so content sniffers - Apache's
`mod_mime_magic`, PHP's `mime_content_type`, some CDN auto-rules - add the
header, and the browser then decompresses the file before JavaScript sees it.
JBrowse needs the raw bytes: it does its own BGZF decompression and seeks into
the file using offsets from `.bai`/`.tbi`/`.csi`/`.gzi`. What you get instead is
truncated data, "invalid BGZF block", or random gaps, and byte range requests
break the same way.

**The fix:** don't set `Content-Encoding` on these files. Serve them as opaque
binary.

- On Apache, disable `mod_mime_magic`, or scope it. To keep it on elsewhere,
  unset the header for genomic extensions:

  ```apache
  <FilesMatch "\.(bam|bai|cram|crai|vcf\.gz|tbi|csi|gff\.gz|bed\.gz|fa\.gz|gzi|fai)$">
    Header unset Content-Encoding
  </FilesMatch>
  ```

- On Nginx, only `gzip` text MIME types. The default `gzip_types` is fine, just
  don't add `application/octet-stream` or `application/gzip`, and don't enable
  `gzip_static` for genomic files.

- On S3 / CloudFront, don't upload with `--content-encoding gzip`. Fix a bad
  upload with `aws s3 cp --content-encoding "" ...`.

- On PHP / app servers, disable auto-content-type middleware on these paths.

To check, open dev tools' Network tab, request the file, and confirm no
`Content-Encoding: gzip` header on the response.

The rule covers the BGZF binary files above only. Compressing `config.json` is
fine, see
[Should I configure gzip on my web server?](#should-i-configure-gzip-on-my-web-server).

### How do I put my data behind a login

JBrowse has no server and no user accounts of its own: it is static files
reading your data over HTTP, so whatever serves the files has to decide who may
read them. Leaving a track out of config.json does not protect it, and a
password in config.json is public.

The usual answer is to put the app and the data on the same origin and protect
both with the login your site already has, so the browser sends its cookie with
every data request and JBrowse needs no configuration at all.
[](/docs/config_guides/authentication) covers that setup, what "same origin"
means in practice, the login-page-instead-of-BAM-bytes failure to watch for, and
the fallbacks (Desktop, presigned URLs, `internetAccounts`) when it does not
fit.

### How can I make a header on a jbrowse-web instance

Edit the index.html that ships with jbrowse-web to add content outside the `div`
the app renders into.

If you want the header to be part of a larger app, use
[`@jbrowse/react-app2`](/docs/embedded_components), which is the whole JBrowse
app as a React component you control the page around. jbrowse-web itself is not
published as an npm package.

### How do I add an assembly (reference genome)

Tracks need an assembly to attach to, so usually you add the assembly first. The
CLI does this with `add-assembly`:

```bash
jbrowse add-assembly hg19.fa.gz -n hg19
```

It indexes the FASTA if needed and writes the assembly entry into config.json.
Indexed FASTA (`.fa` + `.fai`), bgzip indexed FASTA (`.fa.gz` + `.fai` +
`.gzi`), and 2bit all work. The `-n`/`--name` is the name your tracks then refer
to in `assemblyNames`.

On JBrowse Desktop you can do the same thing through the "Open assembly" dialog.
The [assembly configuration guide](/docs/config_guides/assemblies) covers the
rest (aliases, refname aliasing, custom genetic codes), and the cookbook has the
[shortest valid assembly entry](/docs/cookbook#assemblies) if you are writing
config.json by hand.

### How do I load a track into JBrowse 2

The CLI's `add-track` writes the config entry for you. Run it from wherever you
keep your config.json (e.g. /var/www/html/jbrowse2 - you can have several):

```bash
jbrowse add-track myfile.bw -a hg19
jbrowse add-track http://yourremote/myfile.bam
```

`-a` names the assembly, and the track type comes from the file extension and
the index filename (e.g. `myfile.bam.bai`).

You can also edit config.json by hand, or add a track from inside the app (where
it stays in the current session unless the config is writable). The
[cookbook](/docs/cookbook) has a copy-paste config for each common track type,
and [supported file types](/docs/config_guides/file_types) lists which adapter
goes with which format.

### Can I open files from my own computer

[JBrowse Desktop](/docs/quickstart_desktop) opens local files through its file
picker and stores their paths in the session, so it suits data that is not
hosted anywhere.

JBrowse Web can open a local file too, but only for the life of that tab.
Browsers do not let a page re-open a path on disk later, so such a track is gone
after a reload and cannot travel in a share link.

### Can I load a UCSC track hub

Yes. Add the hub's `hub.txt` URL as a connection and its assemblies and tracks
become available. See [connections](/docs/user_guides/connections). To hand
someone a link that opens a hub with no setup at all, use
[`&hubURL=`](/docs/user_guides/hub_url).

### How do I add a plugin

List the plugin's `name` and bundle `url` in the top-level `plugins` array of
config.json, see the [plugins guide](/docs/config_guides/plugins). The
[plugin store page](/plugin_store/) has the config snippet for every published
plugin, and the [in-app plugin store](/docs/user_guides/plugin_store) can
install one into the current session without editing config.json.

### How do I change the color of a track

**In the app (easiest):** open the track menu and choose **Color** to pick a
color. This works for feature tracks (genes/BED/GFF), wiggle tracks, and
alignments (which offer color-by schemes). The choice is saved with your
session.

**In the config:** set `color` in the track's `displayDefaults`. It takes a
plain CSS color, and it is the same `color` whether the track is a feature track
or a wiggle track:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "my_genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
  "displayDefaults": { "color": "green" }
}
```

**In a URL:** set `color` in a track's `displaySnapshot` in the session spec.
See [URL parameters](/docs/urlparams#live-example-feature-track-color).

The [cookbook colors section](/docs/cookbook#colors) has copy-paste versions per
track type, including per-feature jexl callbacks.

### How do I color features by an attribute (color callback)

For per-feature coloring, set `color` to a
[Jexl](https://github.com/TomFrost/Jexl) expression instead of a plain color.
For example, color by strand:

```json
    "color": "jexl:feature.strand==-1?'red':'blue'"
```

The in-app **Color** menu picks a single solid color. To enter a jexl
expression, edit the `color` slot in the track's settings (configuration
editor), or set it in the config or URL as above. See the
[configuration callbacks guide](/docs/config_guides/jexl) for the full jexl
reference, and [more ways to set color](/docs/cookbook#more-ways-to-set-color)
in the cookbook for worked examples (score thresholds, attribute lookups,
filtering features out).

When an expression gets unwieldy, a small plugin can add a function of your own
to the jexl language for it to call. See
[customizing feature colors](/docs/config_guides/customizing_feature_colors/).

### How do I get (more) categories to filter on in the faceted track selector

The faceted selector facets on adapter type, category, and every metadata key.
`jbrowse add-track --category` adds a category (which also groups tracks in the
hierarchical selector), and any `metadata` key on a track becomes a facet of its
own:

```
{
  "name": "mytrack",
  ...
  "metadata": {
    "origin": "public",
    "date_added": "2024-02-20"
  }
}
```

The [hierarchical track selector guide](/docs/config_guides/track_selector)
covers the rest: grouping, sorting, folder categories, and the metadata columns
the faceted selector picks up.

### How do I open JBrowse at a particular location with certain tracks turned on

For everyone who visits your instance, set a
[default session](/docs/config_guides/default_session) in config.json.

For a one-off link, the [URL parameters](/docs/urlparams) `&assembly=`, `&loc=`
and `&tracks=` cover the common case, and a session spec can describe a whole
multi-view state including per-track display settings. [](/docs/automating)
compares all the ways to preset a view (URL, config, embedded props, session
spec), and the cookbook has a
[config to URL](/docs/cookbook#from-config-to-a-url) walkthrough.

### My track loads but my setting has no effect

Most likely the setting is spelled slightly wrong, or is written in a format
from an older JBrowse version. **A config key JBrowse does not recognize is
ignored rather than reported** — the track still appears, so the only symptom is
that your color, height, or filter does nothing.

The CLI checks for exactly this:

```bash
jbrowse validate myconfig.json
```

```
error: tracks[0].assemblyNames: assembly "hg19" is not defined in this config — did you mean "hg38"?
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].init.tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

3 error(s), 0 warning(s) in myconfig.json
```

It checks against config-slot definitions read out of JBrowse itself, so it
knows every track, display and adapter type and the slots each accepts, and it
never opens your data files, so it runs before anything is uploaded. Two levels:

- **error** — JBrowse accepts it and silently does the wrong thing: an unknown
  slot, a track pointing at an assembly the config never defines, a
  `defaultSession` naming a `trackId` that does not exist, a duplicate
  `trackId`.
- **warning** — JBrowse will tell you itself on load, or handles it: a type name
  it does not know (which is expected if a plugin registers it), or a legacy key
  a migration rewrites.

Add `--json` for machine-readable output; it exits non-zero when there are
errors, so it can gate a deploy. See [](/docs/agents) if an AI assistant is
writing the config.

## Behavior and design

### Why do all the tracks need an assembly specified

JBrowse 2 is a multi-genome-assembly browser that can compare genomes side by
side, so every track must declare which assembly it belongs to. This differs
from JBrowse 1, which operated on a single assembly at a time.

### How are the menus structured in the app

In JBrowse 2, the top-level menu performs only global operations. Each view has
its own menu and each track has its own track menu, because a session can hold
many views at once. In JBrowse 1 the app menu operated directly on the single
view.

### What keyboard shortcuts does the linear genome view support

With the view focused (click it first):

- `Ctrl`/`Cmd` + `↑` / `↓` - zoom in / out
- `Ctrl`/`Cmd` + `←` / `→` - pan left / right
- `Ctrl` + mouse wheel - zoom (trackpad pinch also works)
- `Shift` + click-drag - rubberband-select a region
- `Shift` (held, no drag) - show a red vertical guide bar

Undo and redo are app-wide rather than per-view: `Ctrl`/`Cmd` + `Z` undoes and
`Ctrl`/`Cmd` + `Shift` + `Z` (or `Ctrl` + `Y`) redoes anywhere in JBrowse Web
and JBrowse Desktop, including things like reopening a view you just closed. The
embedded components do not include it.

See [](/docs/user_guides/basic_usage#zooming) for the scroll-to-zoom toggle and
other navigation controls.

### Why do some of my reads not display soft-clipping

Some reads, such as secondary reads, do not have a `SEQ` field on their records,
so they will not display soft-clipping.

The soft-clipping indicators on these reads will appear black.

### How does JBrowse know when to display the "Zoom in to see more features" message

Two limits guard the region, and either one shows the message: how many bytes
the fetch would download, and how many features would land on screen.

The message itself is "Zoom in to see features or force load (may be slow)",
usually with the estimated size that tripped it, and the banner's **Force load**
button downloads the region anyway.

On alignments and MAF tracks the message can appear at any zoom, and there it
offers only **Force load**. Those two formats cost bytes per reference base
times something zooming does not reduce — read depth, and the number of aligned
species — so a gene-sized window over a deep pileup or a 470-way alignment is
still tens of megabytes. Other tracks stop being guarded below about 20 kb,
where a small region is a small download.

#### Raising the feature limit

[`maxFeatureScreenDensity`](/docs/config/baselineardisplay/#slot-maxfeaturescreendensity)
is **features per pixel of track width**, and it defaults to `1`. So the feature
count a track will draw is roughly the width of your browser window in pixels:
about 1,500 features on a 1,500px-wide window. Doubling the slot to `2` allows
about 3,000, and so on. It is a density because the same region drawn in a wider
window has more room, so the budget grows with the window.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dense_genes",
  "name": "Genes",
  "assemblyNames": ["volvox"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "volvox.sort.gff3.gz" },
  "displayDefaults": { "maxFeatureScreenDensity": 5 }
}
```

If you only want the region loaded once, the **Force load** button does that
without touching the config. To force it without a click (an embedded view, a
notebook, a screenshot, where nobody can press the button), set
[`forceLoad`](/docs/config/baselineardisplay/#slot-forceload) on the display.

#### Raising the byte limit

[`fetchSizeLimit`](/docs/config/baselineardisplay/#slot-fetchsizelimit) is a
plain byte count. Regions under 20kb are never held back, and adapters that
summarize at screen resolution (bigWig, Hi-C, MultiWiggle, sequence) are never
too large, so neither limit applies to them.

The BAM, CRAM and VCF adapters have their own `fetchSizeLimit`, and an adapter's
limit takes priority over the display's, so for those formats set it on the
adapter:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_cram",
  "name": "volvox CRAM (small fetch size limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "volvox-sorted.cram",
    "fetchSizeLimit": 1000
  }
}
```

## Text searching

For setting up name searching in the first place, see the
[text searching guide](/docs/config_guides/text_searching) and
[indexing feature names](/docs/quickstart_web#indexing-feature-names-for-searching)
in the web quickstart.

### Why am I running out of disk space while trix is running

`jbrowse text-index` writes temporary data to `/tmp`. If that filesystem is low
on space, override the directory with:

```bash
TMPDIR=~/alt_tmp_dir jbrowse text-index
```

### How does the jbrowse text-index trix format work

The `jbrowse text-index` command creates text search indexes using `trix`. The
trix format follows the
[UCSC trix spec](https://genome.ucsc.edu/goldenPath/help/trix.html), but is
re-implemented in the JBrowse CLI so you don't need UCSC tools.

Given input like:

```
GENEID001  Wnt signalling
GENEID002  ey  Pax6
```

It generates an `.ix` file, sorted alphabetically:

```
ey  GENEID002
Pax6  GENEID002
signalling  GENEID001
Wnt  GENEID001
```

A second file, `.ixx`, records the byte offset of each line, e.g.:

```
signa000000435
```

JBrowse also extends the standard trix format: the `.ix` file includes each
feature's name and genomic location in an encoded format.

## URL params

### Why can't I copy and paste my URL bar to share it with another user

Sessions can grow too large to fit in a URL, so JBrowse stores the session in
sessionStorage/IndexedDB and keeps only the session ID in the URL bar. Use the
Share button to generate a proper shareable link.

`@jbrowse/react-linear-genome-view2` makes no attempt to access URL query
params. That logic must be implemented by the embedding application.

Pasting the URL bar into another tab on the same computer restores the session
from sessionStorage (same tab) or IndexedDB (new tab), but those sessions are
not accessible to other users.

To build the link yourself, the [URL parameters](/docs/urlparams) page documents
every form, from a plain `&loc=` to a full session spec.

### How does session sharing with shortened URLs work in JBrowse Web

The Share button generates a random encryption key on the client, encrypts the
session, and uploads the encrypted blob (without the key) to an AWS DynamoDB
database.

This produces a URL of the form:

`&session=share-<DYNAMODBID>&password=<DECODEKEY>`

The DECODEKEY is never transmitted to the server. The recipient downloads the
DynamoDB entry and decodes it using the key embedded in the URL.

The DynamoDB contents cannot be decrypted even by JBrowse administrators.

### Are my share links reproducible

It depends which link you mean. The gear icon in the Share dialog offers three
formats:

- The short link (`&session=share-<ID>&password=<KEY>`) is _not_. Each click of
  Share mints a new random key and uploads a new encrypted blob, so the same
  view gives a new `<ID>`/`<KEY>` pair every time. The link is by design just a
  key into our hosted store.

- **Long URL** and **Plaintext JSON** _are_. Both carry the whole session in the
  link itself - compressed for the first, readable JSON for the second - with no
  server round-trip and no minted password, so the same view and config produce
  the same link, and it survives rebuilding or moving your instance. Being long,
  both go [into the URL fragment](/docs/urlparams#query-string-or-hash-fragment)
  rather than the query string.

Your **config** can still break reproducibility. A restored session references
tracks by `trackId`, so a redeploy that regenerates `config.json` with different
`trackId`s leaves the link unable to find those tracks. See
[keeping trackIds stable](/docs/config_guides/deploying/#keep-trackids-stable-for-reproducible-links)
and
[why a saved session fails to load](#why-does-my-saved-session-fail-to-load).

## Troubleshooting

### Where can I get help or report a bug

Post questions on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions)
or [contact us](/contact). To report a bug, open an issue on
[GitHub](https://github.com/GMOD/jbrowse-components/issues).

### My track loads but shows no features

If the track turns on without any error but stays empty where you expect data,
this is usually a reference name mismatch: the file names its chromosomes
differently than your assembly (e.g. `chr1` vs `1`, or `NC_000001.11` vs
`chr1`). JBrowse matches features by exact reference name, so `chr1` data won't
show up on a region the assembly calls `1`.

To check, open the track menu and click "About track" for the reference names
the file actually contains. The other side of the comparison is that same dialog
on the **reference sequence track**: its "Assembly" section lists every name the
assembly knows and the aliases already mapped onto each one, which is where you
see whether an alias file applied. If the two don't match, add
[reference name aliasing](/docs/config_guides/assemblies#configuring-reference-name-aliasing)
to the assembly to map the two naming schemes together. The
[RefName aliasing guide](/docs/developer_guides/refname_aliasing) has the
details.

A few other things worth checking:

- you're not zoomed into a region that simply has no data there
- there isn't a "Zoom in to see features" message showing (see
  [the stats-estimation question](#how-does-jbrowse-know-when-to-display-the-zoom-in-to-see-more-features-message))

(A file that's bgzip compressed or tabix/CSI indexed incorrectly usually throws
an error rather than rendering blank.)

### My tracks are blank or render incorrectly

If the menus and track names look fine but the features themselves are missing,
smeared, or the wrong color, the drawing path is the likely cause.
[`&renderer=`](/docs/urlparams#renderer) pins which one is used, so you can try
each in turn:

- no parameter - the usual WebGPU-first detection
- `?renderer=webgpu` - require WebGPU
- `?renderer=webgl` - WebGL2
- `?renderer=canvas2d` - software drawing

On JBrowse Desktop the same choice is the
[`--renderer` flag](/docs/quickstart_desktop#launching-from-the-command-line).

That identifies where the problem is, so please
[open an issue](https://github.com/GMOD/jbrowse-components/issues) noting which
of the three worked, along with your browser, operating system and graphics
card. Graphics errors are printed to the browser's developer console, so include
anything there.

With many views open, the browser can hit its limit on live WebGL contexts
(Chrome allows about 16) and take one back from a track, which shows as a "WebGL
context lost" banner there. Retry gets it back if another view has since freed
capacity, and the banner's **Use Canvas2D** button switches drawing to software
for the rest of the session: slower on dense data, unaffected by how many views
are open. Closing views you aren't using also frees contexts.

### Why is my track slow

For an indexed file, the time goes into fetching and decoding the region in
view. Deep alignment tracks at wide zoom levels dominate, with thousands of
reads to download, decode and lay out. CRAM costs more CPU to decode than BAM,
being reference-compressed. The
[region size gate](#how-does-jbrowse-know-when-to-display-the-zoom-in-to-see-more-features-message)
is what keeps a wide view from attempting this by accident.

Some adapters read a plain text file with no index (`Gff3Adapter`, `VcfAdapter`,
`BedAdapter`, `PAFAdapter`). These parse the whole file each time the track
loads, which is reasonable for a small file. Converting to the bgzip and tabix
indexed equivalent, or to [PIF](/docs/developer_guides/pif_format)
(`jbrowse make-pif`) for PAF, changes the cost from whole-file to per-region.
The cookbook's [large alignments](/docs/cookbook#synteny-large-alignments)
recipe covers the synteny case.

Server behavior matters as well. Reads are many small range requests, so latency
counts for more than bandwidth, and a server that ignores `Range` and returns
whole files turns every read into a full download. See
[what web server do I need](#what-web-server-do-i-need-to-run-jbrowse-2).

### Why do I get a CORS error when loading remote files

This happens when JBrowse is served from a different domain than your data (e.g.
JBrowse on one host, data on a separate S3 / MinIO bucket). JBrowse cannot work
around CORS restrictions. The fix must be on the data server.

At minimum the data server must:

- return `Access-Control-Allow-Origin` matching your JBrowse origin (or `*`),
- allow the `Range` request header (`Access-Control-Allow-Headers: Range`), and
- honor byte-range requests: respond `206 Partial Content` with the requested
  bytes (not `200` with the whole file).

You do **not** need to expose `Content-Range`: JBrowse detects end-of-file from
short/`416` range responses, so range reads work even when CORS hides it.
Exposing it is optional polish, letting JBrowse report the true file size in a
few places like the spreadsheet importer. `Content-Length` is CORS-safelisted
and always readable, so download progress works either way.

For local development only, launching Chrome with `--disable-web-security` is a
temporary workaround.

#### S3 / MinIO CORS configuration

Apply this CORS policy to the bucket (S3 console → bucket → Permissions →
Cross-origin resource sharing, or the CLI below). Replace the origin with your
JBrowse host, or use `["*"]` for public data:

```json
[
  {
    "AllowedOrigins": ["https://your-jbrowse-host.example.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"]
  }
]
```

One-liner to apply it with the AWS CLI:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration \
  '{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range"],"ExposeHeaders":["Content-Range","Content-Length","Accept-Ranges"]}]}'
```

To verify, open dev tools' Network tab and confirm the file request returns
`206 Partial Content` with an `Access-Control-Allow-Origin` header.

For **MinIO**, per-bucket CORS (`mc cors set` / the `put-bucket-cors` S3 API) is
only available in MinIO AIStor (the commercial edition). The community server
instead controls CORS globally with the `MINIO_API_CORS_ALLOW_ORIGIN`
environment variable, a comma-separated origin list that defaults to `*` (all
origins). Set it to your JBrowse origin and restart the server:

```bash
export MINIO_API_CORS_ALLOW_ORIGIN="https://your-jbrowse-host.example.com"
```

### Why does my saved session fail to load

Changing or deleting a track's ID breaks any saved session that references it.
The whole session fails, not just that track.

### What should I do if the Share system isn't working

If sharing isn't working (e.g. you're behind a firewall), click the "Gear" icon
in the Share dialog to switch to "Long URL" mode, which doesn't require the
central server.

To use your own URL shortener, set the `shareURL` parameter in config.json to
your server.

### Embedded views versus full JBrowse app

Embedded views are designed for genome browsing within an existing webpage. For
a standalone browser, run JBrowse Web instead.

`@jbrowse/react-app2` sits between an embedded view and a deployed instance: the
whole JBrowse app as a React component. See
[embedded components](/docs/embedded_components) for picking a package, and
[automating JBrowse](/docs/automating) for driving any of them from code.

|                | Single-view components (LGV, CGV) | `@jbrowse/react-app2`                      | JBrowse Web                                                      |
| -------------- | --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| View types     | One only                          | All of them, plugins included              | All of them, plugins included                                    |
| Feature detail | Opens in a dialog                 | Opens in a drawer                          | Opens in a left/right oriented drawer                            |
| Sessions       | No built-in saving or loading     | Held in your app's state, yours to persist | Save, import, export, plus local autosave                        |
| URLs           | The page owns the URL             | The page owns the URL                      | Reads [URL params](/docs/urlparams) like `&loc=` and `&session=` |

**All of them can:**

- enable/disable tracks through the Track interface
- change the track's assembly based on what is available in the configuration
- manipulate the views with zoom, horizontal flip, view all regions, track label
  positioning, etc.
- change track display options
- export the view as an SVG

Embedded components are designed for web developers to build custom systems
around, so features like sessions and track manipulation can be implemented by
the embedding application. If your app is Python or R rather than JavaScript,
[](/docs/jbrowse_anywidget) and [](/docs/jbrowser) wrap the same views.

## Related systems and credit

JBrowse 2 stands on the shoulders of many great scientists that came before us.
Points of reference:

- Savant genome browser: genome arcs
- Gap5 genome browser: the read cloud, a cousin of genome arcs
- [Mummerplots](https://jmonlong.github.io/Hippocamplus/2017/09/19/mummerplots-with-ggplot2/):
  auto-diagonalization routines for better synteny figures
- minimap2 and the PAF format: the basis our synteny visualizations are built on
- samtools and the hts-specs community: a continued substrate for complex
  bioinformatics formats like BAM, CRAM and VCF
- pggb, cactus and the other pangenome tool developers: for proving pangenomics
  works
- chain2paf, paftools.js and the rest of the ecosystem that grew around PAF
- jcvi/MCScan: the easy protein-alignment synteny workflow we standardized
  around, whose `.anchors` and `.blocks` formats other programs (the OrthoFinder
  workflow among them) use to this day
- ReactJS, TypeScript, mobx-state-tree and the JavaScript community: building a
  bioinformatics ecosystem on the web is hard when most of the field works in
  other languages
- IGV and igv.js: much of the alignments track, particularly read pairing and
  modBAM color schemes, view as pairs, and link supplementary alignments
- D-GENIES: for establishing a very high quality, easy to use dotplot viewer
- GenomeSpy and HiGlass/Gosling: for proving WebGL powered browsers
- [Every other genome visualization developer](https://cmdcolin.github.io/awesome-genome-visualization/?latest=true)
