---
title: FAQ
---

## Developers

### How can I start the JBrowse 2 app as a developer

We recommend that you have the following:

- A stable and recent version of [node](https://nodejs.org/en/)
- Git
- [pnpm](https://pnpm.io/installation)

Then you can follow the steps from our
[README](https://github.com/gmod/jbrowse-components).

It basically boils down to:

```bash
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
pnpm install
cd products/jbrowse-web
pnpm start
```

This will boot up a development instance of `jbrowse-web` on port `3000`.

You can use `PORT=8080 pnpm start` to manually specify a different port.

Alternatively, to boot up JBrowse Desktop, you can go to the
`products/jbrowse-desktop` directory.

For the embedded components e.g. `products/jbrowse-react-linear-genome-view`,
use `pnpm storybook` instead of `pnpm start`. (Note: the source folder names in
`products/` do not include the trailing `2`, but the published npm packages do:
`@jbrowse/react-linear-genome-view2`, `@jbrowse/react-app2`,
`@jbrowse/react-circular-genome-view2`.)

## General

### What is special about JBrowse 2

JBrowse 2's plugin system supports custom view types (e.g. circular, dotplot)
alongside the built-in ones, making it a platform for genomic visualization, not
only a genome browser.

### What is the difference between JBrowse Web and JBrowse Desktop

JBrowse Web is a static web app you deploy to a server; anyone with the URL can
use it. JBrowse Desktop is an Electron app that runs locally on a user's
machine, can open local files directly, and does not require a server.

### What are new features in JBrowse 2

See the [features page](https://jbrowse.org/jb2/features) for a full overview.
Highlights include multi-assembly comparison, synteny/dotplot views, a circular
genome view, Hi-C display, and an SV inspector.

### How do I convert my JBrowse 1 configuration to JBrowse 2

There is no official migration tool. The config formats differ significantly, so
you will generally need to set up tracks fresh in JBrowse 2 using the CLI or
GUI.

For reference, community scripts like
[this gist](https://gist.github.com/cmdcolin/2ef875fc19c5f164aad41bd330f1bb37)
can help extract track definitions from a JBrowse 1 config.

JBrowse 2 also has a built-in **JBrowse 1 connection** feature that can connect
directly to a running JBrowse 1 data directory and read its `trackList.json`,
letting you browse your existing JBrowse 1 tracks without a full migration. This
is not recommended for most purposes — it is limited in functionality and is
mainly useful as a temporary bridge.

## Setup

### What web server do I need to run JBrowse 2

JBrowse 2 is just static JS/CSS/HTML — no backend required. Deploy by copying
the folder to your web server (e.g. `/var/www/html/`) or Amazon S3.

If you use Django, put jbrowse-web in the static resources folder, but serve
data files from a separate server (Django's static resources folder won't serve
them correctly). For some informal troubleshooting notes, see
[these notes](https://github.com/cmdcolin/django-jbrowse2-nonworking-example).

Note that the server that you use should support byte-range requests (e.g. the
[Range HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range))
so that JBrowse can get small slices of large binary data files.

### BAM (or other indexed binary files) do not work on my server

Almost always: the server is sending `Content-Encoding: gzip` on a
BGZF-compressed file (BAM, VCF.gz, GFF.gz, BED.gz, .fa.gz, etc.).

BGZF looks like gzip to the server, so content-sniffers like Apache's
`mod_mime_magic`, PHP's `mime_content_type`, and some CDN auto-rules add the
header. The browser then silently decompresses the file before JavaScript sees
it. JBrowse needs the raw bytes — it does its own BGZF decompression and seeks
into the file using offsets from `.bai`/`.tbi`/`.csi`/`.gzi` — so reads fail
with truncated data, "invalid BGZF block", or random gaps. Byte range requests
break for the same reason.

**The fix:** don't set `Content-Encoding` on these files. Serve them as opaque
binary.

- **Apache** — disable `mod_mime_magic`, or scope it. To keep it on elsewhere,
  unset the header for genomic extensions:

  ```apache
  <FilesMatch "\.(bam|bai|cram|crai|vcf\.gz|tbi|csi|gff\.gz|bed\.gz|fa\.gz|gzi|fai)$">
    Header unset Content-Encoding
  </FilesMatch>
  ```

- **Nginx** — only `gzip` text MIME types (the default `gzip_types` is fine;
  don't add `application/octet-stream` or `application/gzip`). Don't enable
  `gzip_static` for genomic files.

- **S3 / CloudFront** — don't upload with `--content-encoding gzip`. Fix a bad
  upload with `aws s3 cp --content-encoding "" ...`.

- **PHP / app servers** — disable auto-content-type middleware on these paths.

To check, open dev tools' Network tab, request the file, and confirm no
`Content-Encoding: gzip` header on the response.

Compressing `config.json` with `Content-Encoding: gzip` is fine — that's just a
text file. The rule only applies to BGZF binary files. See also
[How do I reduce config.json download size?](#how-do-i-reduce-configjson-download-size).

### How can I setup JBrowse 2 on my web server

We recommend following the steps in the
[quickstart web via CLI](/docs/quickstart_web) guide.

`jbrowse create /var/www/html/jb2` downloads the latest JBrowse into that
folder. Run `jbrowse upgrade /var/www/html/jb2` to update it later.

### How do I install or update the @jbrowse/cli tool

Install with `npm install -g @jbrowse/cli`. Re-running the same command updates
it.

This adds a `jbrowse` command to your PATH (assuming a standard Node.js
installation via nodesource or nvm). Note: the CLI only prepares your
config.json — it **does not run server-side code**.

### How can I make a header on a jbrowse-web instance

Edit the index.html that ships with jbrowse-web to add content outside the `div`
the app renders into. For more advanced embedding, consider
@jbrowse/react-linear-genome-view2 or similar; jbrowse-web itself is not yet
available as an npm package.

### How do I update my instance of jbrowse-web

You can use the command, after installing `@jbrowse/cli`:

```
jbrowse upgrade /path/to/your/jbrowse2
```

This downloads the latest release from GitHub and overwrites your jbrowse-web
instance.

If you've manually downloaded jbrowse-web, the newest releases can be found
[here](https://github.com/GMOD/jbrowse-components/releases).

### How can I setup JBrowse 2 without the CLI tools

The CLI is the easiest way to add assemblies and tracks — `jbrowse add-track`
will figure out the track type, index files, and config entries for you — so we
recommend it for most setups. But it is not required.

To set up JBrowse without the CLI, download a zip from the
[releases page](https://github.com/GMOD/jbrowse-components/releases) and unzip
it into your web directory. From there you can:

- edit `config.json` in a text editor — see the
  [config guide](/docs/config_guide) and
  [config basics](/docs/config_guides/intro)
- use the [admin server](/docs/quickstart_adminserver), which provides a GUI for
  editing the config

The [quickstart web](/docs/quickstart_web) guide walks through both the CLI and
the manual setup. Questions of any kind are welcome on the
[discussions board](https://github.com/GMOD/jbrowse-components/discussions), or
feel free to [contact us](/contact) directly.

### How do I load a track into JBrowse 2

With the JBrowse CLI tools, you can easily add tracks with the `add-track`
command, e.g.:

    jbrowse add-track myfile.bw -a hg19

This will set up a bigwig track on the hg19 assembly in your config.json.

Run the command from your jbrowse2 folder (e.g. /var/www/html/jbrowse2), or
wherever you keep your config.json (you can have multiple configs).

You can also use remote URLs:

    jbrowse add-track http://yourremote/myfile.bam

`add-track` infers the track type from the file extension and the index filename
(e.g. `myfile.bam.bai`).

You can also manually edit your config file or use the GUI.

### How do I customize the color of the features displayed on my track

We use [Jexl](https://github.com/TomFrost/Jexl) for defining configuration
callbacks, including feature coloration.

An example of a Jexl configuration callback might look like this:

```json
    "color": "jexl:get(feature,'strand')==-1?'red':'blue'"
```

See our [configuration callbacks guide](/docs/config_guides/jexl) for more
information.

### My jexl is too complicated, how can I simplify it?

You can create a small plugin that adds a new function to the jexl language.

See [here](/docs/config_guides/customizing_feature_colors/) for an example of
making a color callback.

#### Adding color callbacks in the GUI

To add a color callback in the GUI, open the track's settings and set the color
callback on the renderer/display. The callback is a
[Jexl](https://github.com/TomFrost/Jexl) expression, e.g.
`get(feature,'strand') == -1 ? 'red' : 'blue'`.

#### Adding color callbacks via the command line

The color callback (`color1`) is a display-level setting, so you supply a
`displays` entry via `--config`. To add one to a track using the CLI, your
`add-track` looks something like this:

```bash
jbrowse add-track somevariants.vcf --load copy --config '{"displays": [{"displayId": "somevariants-LinearVariantDisplay", "type": "LinearVariantDisplay", "color1": "jexl:get(feature, '\''strand'\'') == -1 ? '\''red'\'' : '\''blue'\''"}]}'
```

The `--config` option adds extra configuration — here, a color callback on the
display. A `.vcf` file uses `LinearVariantDisplay`; a feature track (BED/GFF)
uses `LinearBasicDisplay`.

### How do I get (more) categories to filter on in the faceted track selector?

The faceted track selector displays all the different adapters, categories, and
all the metadata. Categories are also used to group tracks in the track
selector. New categories can be added with the `--category` option from
`jbrowse add-track`.

Alternatively, you can add a metadata key to a track, which will be used in the
faceted track selector:

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

### How do I reduce config.json download size?

You can set up your server to serve zipped files. Most cloud-based services,
like AWS Amplify and AWS CloudFront, already do this automatically. However, for
Apache and Nginx, you need to configure them manually.

For Nginx, add to your server block:

```nginx
gzip on;
gzip_types application/json text/plain text/html text/css text/javascript application/javascript;
```

To enable compression in Apache, you can use the mod_deflate module.

```
sudo a2enmod deflate
sudo systemctl restart apache2
```

Add the following configuration to your Apache configuration file (e.g.,
/etc/apache2/sites-available/000-default.conf):

```
<IfModule mod_deflate.c>
    # Compress output
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

```

With gzip enabled, config.json and other specified files are served compressed,
reducing download sizes.

## Behavior and design

### Why do all the tracks need an assembly specified

JBrowse 2 is a multi-genome-assembly browser that can compare genomes side by
side, so every track must declare which assembly it belongs to. This differs
from JBrowse 1, which operated on a single assembly at a time.

### How are the menus structured in the app

In JBrowse 2, the top-level menu performs only global operations; each linear
genome view has its own hamburger menu and each track has its own track menu. In
JBrowse 1 the app menu operated directly on the single view.

### Why do some of my reads not display soft-clipping

Some reads, such as secondary reads, do not have a `SEQ` field on their records,
so they will not display soft-clipping.

The soft-clipping indicators on these reads will appear black.

### Do you have any tips for learning React and @jbrowse/mobx-state-tree

See this
[short orientation guide](https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f).

### What technologies does JBrowse 2 use

Key technologies include:

- React
- @jbrowse/mobx-state-tree
- web-workers
- Typescript
- Electron (for desktop specifically)

### Should I configure gzip on my web server

Yes. JBrowse 2 loads ~5MB of JS resources (~2.5MB each for main and worker
bundles), but gzip reduces the download to ~1.4MB. How to enable it depends on
your server (Apache, Nginx, AWS CloudFront, S3, etc.). See also
[How do I reduce config.json download size?](#how-do-i-reduce-configjson-download-size).

### How does JBrowse know when to display the "Zoom in to see more features" message

JBrowse uses "stats estimation" rules to decide when to show this message:

- No message is shown when zoomed in to <20kb
- BAM and CRAM files use byte size estimation (shown alongside the message)
- Other data types use feature density calculation
- Hi-C, BigWig, and sequence adapters are hardcoded to `{ featureDensity:0 }`
  and always render

If you need to customize your particular track, you can set config variables on
the "display" section of your config

- `maxFeatureScreenDensity` - the maximum number of features per pixel allowed
  before the "zoom in to see features" message is shown (default 0.3)
- `fetchSizeLimit` - this config variable exists on the adapters (can increase
  size limit)

Example config with a small feature screen density:

```json
{
  "type": "VariantTrack",
  "trackId": "variant_density",
  "name": "test variants (small featuredensity limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "volvox.filtered.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "volvox.filtered.vcf.gz.tbi"
      }
    }
  },
  "displays": [
    {
      "type": "LinearVariantDisplay",
      "maxFeatureScreenDensity": 0.0006,
      "displayId": "volvox_filtered_vcf_color-LinearVariantDisplay"
    }
  ]
}
```

Example config for a CRAM file with a small `fetchSizeLimit` configured:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_cram",
  "name": "test track (small fetch size limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "cramLocation": {
      "uri": "volvox-sorted-altname.cram"
    },
    "craiLocation": {
      "uri": "volvox-sorted-altname.cram.crai"
    },
    "sequenceAdapter": {
      "type": "TwoBitAdapter",
      "twoBitLocation": {
        "uri": "volvox.2bit"
      }
    },
    "fetchSizeLimit": 1000
  }
}
```

## Text searching

### Why am I running out of disk space while trix is running

The `jbrowse text-index` program will output data to a TMP directory while
indexing. If your filesystem has low diskspace for /tmp you can set an
alternative temporary directory using the environment variable
`TMPDIR=~/alt_tmp_dir/ jbrowse text-index`.

### How does the jbrowse text-index trix format work

The `jbrowse text-index` command creates text searching indexes using `trix`.
The trix indexes are based on the format described by UCSC here
https://genome.ucsc.edu/goldenPath/help/trix.html, but we re-implemented the
code to create these index formats in the JBrowse CLI so you do not have to
install the UCSC tools.

The main idea is that you give trix:

```
GENEID001  Wnt signalling
GENEID002  ey  Pax6
```

Then this will generate a new file, the .ix file, sorted in alphabetical order:

```
ey  GENEID002
Pax6  GENEID002
signalling  GENEID001
Wnt  GENEID001
```

Then a second file, the `.ixx` file, tells us at what byte offset certain lines
in the file are e.g.

```
signa000000435
```

Note that JBrowse creates a specialized trix index also. Instead of creating a
`ix` file with just the gene names, it also provides their name and location in
an encoded format.

## URL params

### Why can't I copy and paste my URL bar to share it with another user

Sessions can grow too large to fit in a URL, so JBrowse stores the session in
sessionStorage/IndexedDB and keeps only the session ID in the URL bar. Use the
Share button to generate a proper shareable link.

Note 1: @jbrowse/react-linear-genome-view2 makes no attempt to access URL query
params — that logic must be implemented by the embedding application.

Note 2: Pasting the URL bar into another tab on the same computer will restore
the session from sessionStorage (same tab) or IndexedDB (new tab), but those
sessions are not accessible to other users.

### How does session sharing with shortened URLs work in JBrowse Web

The Share button generates a random encryption key on the client, encrypts the
session, and uploads the encrypted blob (without the key) to an AWS DynamoDB
database.

This produces a URL of the form:

&session=share-&lt;DYNAMODBID&gt;&password=&lt;DECODEKEY&gt;

The DECODEKEY is never transmitted to the server. The recipient downloads the
DynamoDB entry and decodes it using the key embedded in the URL.

The DynamoDB contents cannot be decrypted even by JBrowse administrators.

## Troubleshooting

### Where can I get help or report a bug?

Post questions on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions)
or [contact us](/contact). To report a bug, open an issue on
[GitHub](https://github.com/GMOD/jbrowse-components/issues).

### Why do I get a CORS error when loading remote files?

The remote server must return `Access-Control-Allow-Origin: *` (or your origin)
and allow the `Range` header (`Access-Control-Allow-Headers: Range`). JBrowse
cannot work around CORS restrictions — the fix must be on the data server. For
local development only, launching Chrome with `--disable-web-security` is a
temporary workaround.

### Why does my saved session fail to load?

Changing track IDs or deleting tracks can cause saved sessions to fail to load,
since any inconsistency causes the entire session to fail. Make these changes
carefully.

### What should I do if the Share system isn't working?

If sharing isn't working (e.g. you're behind a firewall), click the "Gear" icon
in the Share dialog to switch to "Long URL" mode, which doesn't require the
central server.

To use your own URL shortener, set the `shareURL` parameter in config.json to
your server.

### Embedded views versus full JBrowse app

Embedded views are designed for genome browsing within an existing webpage. For
a standalone browser, run JBrowse Web instead. Key differences:

| Embedded components                                     | JBrowse Web                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Only has access to one view type                        | Access to all view types loaded into the JBrowse session, including those from plugins |
| Feature details and track selector open as a dialog     | Feature details open as a left/right oriented drawer                                   |
| No built-in concept of local session, saving or loading | Save / import / export session options for any user                                    |

**Both can:**

- enable/disable tracks through the Track interface
- change the track's assembly based on what is available in the configuration
- manipulate the views with zoom, horizontal flip, view all regions, track label
  positioning, etc.
- change track display options
- export the view as an SVG

Embedded components are designed for web developers to build custom systems
around, so features like sessions and track manipulation can be implemented by
the embedding application.
