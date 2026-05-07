---
id: faq
title: FAQ
toplevel: true
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
use `pnpm storybook` instead of `pnpm start`.

## General

### What is special about JBrowse 2

JBrowse 2's plugin system supports custom view types (e.g. circular, dotplot)
alongside the built-in ones, making it a platform you can build on rather than
just a genome browser.

### What are new features in JBrowse 2

See the [features page](https://jbrowse.org/jb2/features) for an overview of
features

## Setup

### What web server do I need to run JBrowse 2

JBrowse 2 is just static JS/CSS/HTML — no backend required. Deploy by copying
the folder to your web server (e.g. `/var/www/html/`) or Amazon S3.

If you use Django, put jbrowse-web in the static resources folder, but serve
data files from a separate server (Django's static resources folder won't serve
them correctly). See https://github.com/cmdcolin/django-jbrowse2-nonworking-example
for notes.

Note that the server that you use should support byte-range requests (e.g. the
[Range HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range))
so that JBrowse can get small slices of large binary data files.

### BAM files do not work on my server

If you are using Apache then you will probably want to disable mime_magic. If
mime_magic is enabled, you may see that your server responds with the HTTP
header Content-Encoding: gzip which JBrowse does NOT want, because this
instructs the browser to unzip the data but JBrowse should be in charge of this.

### How can I setup JBrowse 2 on my web server

We recommend following the steps in the
[quickstart web via CLI](/docs/quickstart_web) guide.

The general procedure is using the `jbrowse create /var/www/html/jb2` and this
will download the latest version of jbrowse to your web folder e.g. in
`/var/www/html`.

You can also use `jbrowse upgrade /var/www/html/jb2` to get the latest version.

### How do I install or update the @jbrowse/cli tool

Install with `npm install -g @jbrowse/cli`. Re-running the same command updates it.

This adds a `jbrowse` command to your PATH (assuming a standard Node.js
installation via nodesource or nvm). Note: the CLI only prepares your
config.json — it **does not run server-side code**.

### How can I make a header on a jbrowse-web instance

Edit the index.html that ships with jbrowse-web to add content outside the
`div` the app renders into. For more advanced embedding, consider
@jbrowse/react-linear-genome-view2 or similar; jbrowse-web itself is not yet
available as an npm package.

### How do I update my instance of jbrowse-web

You can use the command, after installing:

```
jbrowse upgrade /path/to/your/jbrowse2
```

This will download the latest release from github and overwrite it onto your
jbrowse-web instance.

If you've manually downloaded jbrowse-web, the newest releases can be found
[here](https://github.com/GMOD/jbrowse-components/releases).

### How can I setup JBrowse 2 without the CLI tools

The CLI is a convenience — it's not strictly required.

For `jbrowse create`, download the latest jbrowse-web zip from the
[releases page](https://github.com/GMOD/jbrowse-components/releases) and unzip
it into your web directory.

Checkout our [quickstart web](/docs/quickstart_web) guide for a speedy start to
using a manually downloaded JBrowse instance.

For `add-assembly` and `add-track`, manually edit `config.json` — the
[config docs](/docs/config_guide) and sample configs are useful references.

To configure JBrowse via the GUI, see the
[admin server tutorial](/docs/quickstart_adminserver).

Understanding [config basics](/docs/config_guides/intro) is helpful for manual
editing, though note that corrupt configs can produce hard-to-diagnose errors
since the config system is strongly typed.

[Contact us](/contact) or ask in the
[discussions](https://github.com/GMOD/jbrowse-components/discussions) for
complex configuration issues.

### How do I load a track into JBrowse 2

With the JBrowse CLI tools, you can easily add tracks with the `add-track`
command, e.g.:

    jbrowse add-track myfile.bw -a hg19

This will set up a bigwig track on the hg19 assembly in your config.json.

Run the command from your jbrowse2 folder (e.g. /var/www/html/jbrowse2), or
wherever you keep your config.json (you can have multiple configs).

You can also use remote URLs:

    jbrowse add-track http://yourremote/myfile.bam

`add-track` infers the track type from the file extension and the index
filename (e.g. `myfile.bam.bai`).

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

### Adding color callbacks in the GUI

In brief, to add a configuration callback to a track using the GUI, perform the
following steps:

1. On the track you intend to color, click on the three vertical dots '...' on
   the right side of the track label
2. Click "Settings" (if this option is greyed out, copy the track with "Copy
   Track", then open up the track under "Session Tracks" and repeat steps 1-2)
3. Scroll down to the "display 1 renderer" heading (this is typically the
   display you want to edit, if not scroll to display 2)
4. Click on the circle to the right of the color you'd like to change
5. In this text box, enter in the [Jexl](https://github.com/TomFrost/Jexl)
   callback for the feature coloration, e.g.
   `get(feature,'strand') == -1 ? 'red' : 'blue'`

### Adding color callbacks via the command line

Adding color callbacks via the CLI is a bit tricky because the coloration
property lives inside the renderer.

In brief, to add a configuration callback to a track using the CLI, your
`add-track` is going to look something like this:

```bash
jbrowse add-track somevariants.vcf --load copy --config '{"displays": [{"displayId": "my_BasicDisplay", "type": "LinearBasicDisplay", "renderer": {"color1": "jexl:get(feature, '\''strand'\'') == -1 ? '\''red'\'' : '\''blue'\''" }}]}'
```

The `--config` option adds extra configuration — here, a renderer on the
display. A .vcf file uses `LinearBasicDisplay`.

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
    "data_added": "2024-02-20"
  }
}
```

### Can I compress the config.json, it's large and users have to download it?

You can set up your server to serve zipped files. Most cloud-based services,
like AWS Amplify and AWS CloudFront, already do this automatically. However, for
Apache and Nginx, you need to configure them manually.

For Nginx, you can enable gzip compression by editing the config.template. See
for instance for a set of reasonable nginx defaults:
https://gist.github.com/sydcanem/3e00c09b3361927b2fd1#file-nginx-gzip-conf

```
server {
    ...
    # Enable gzip compression.
    # Default: off
    gzip on;

    # make sure to **at least** allow json to be compressed, multiple
    gzip_types
      application/json
}
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

By enabling gzip compression, your config.json and other specified files will be
served in a compressed format, reducing the file size and improving download
times for your users.

## Curiosities

### Why do all the tracks need an assembly specified

We require that all tracks have a specific genome assembly specified in their
config. This is because JBrowse 2 is a multi-genome-assembly browser (and can
compare genomes given the data). This may be different to using, say, JBrowse 1
where it knows which genome assembly you are working with at any given time.

### How are the menus structured in the app

In JBrowse 1, the app level menu operated on the single linear genome view, but
with JBrowse 2, the top level menu only performs global operations and the
linear genome view has its own hamburger menu. Note that each track also has its
own track level menu.

### Why do some of my reads not display soft-clipping

Some reads, such as secondary reads, do not have a `SEQ` field on their records,
so they will not display soft-clipping.

The soft-clipping indicators on these reads will appear black.

### Do you have any tips for learning React and @jbrowse/mobx-state-tree

Here is a short guide to React and @jbrowse/mobx-state-tree that could help get
you oriented:

https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f

### What technologies does JBrowse 2 use

We build on a lot of great open source technology, some main ones include:

- React
- @jbrowse/mobx-state-tree
- web-workers
- Typescript
- Electron (for desktop specifically)

### Should I configure gzip on my web server

Yes. JBrowse 2 loads ~5MB of JS resources (~2.5MB each for main and worker
bundles), but gzip reduces the download to ~1.4MB. How to enable it depends on
your server (Apache, Nginx, AWS CloudFront, S3, etc.).

### How does JBrowse know when to display the "Zoom in to see more features" message

JBrowse uses "stats estimation" rules to decide when to show this message:

- No message is shown when zoomed in to <20kb
- BAM and CRAM files use byte size estimation (shown alongside the message)
- Other data types use feature density calculation
- Hi-C, BigWig, and sequence adapters are hardcoded to `{ featureDensity:0 }`
  and always render

If you need to customize your particular track, you can set config variables on
the "display" section of your config

- `maxFeatureScreenDensity` - number of features times bpPerPx
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

### Why I am running out of disk space while trix is running

The `jbrowse text-index` program will output data to a TMP directory while
indexing. If your filesystem has low diskspace for /tmp you can set an
alternative temporary directory using the environment variable
`TMPDIR=~/alt_tmp_dir/ jbrowse text-index`.

### How does the jbrowse text-index trix format work

The `jbrowse text-index` command creates text searching indexes using `trix`.
The trix indexes are based on the format described by UCSC here
https://genome.ucsc.edu/goldenPath/help/trix.html, but we re-implemented the
code the create these index formats in the JBrowse CLI so you do not have to
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

Note 1: @jbrowse/react-linear-genome-view2 makes no attempt to access URL
query params — that logic must be implemented by the embedding application.

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

Changing track IDs or deleting tracks can cause saved sessions to fail to load,
since any inconsistency causes the entire session to fail. Make these changes
carefully.

### What should I do if the Share system isn't working?

If for any reason the session sharing system isn't working, e.g. you are behind
a firewall, or you are not able to connect to the central share server, you can
click the "Gear" icon in the "Share" button pop-up, and it will give you the
option to use "Long URL" instead of "Short URL" which lets you create share
links without the central server.

Also, if you are implementing JBrowse Web on your own server and would like to
create your own URL shortener, you can use the shareURL parameter in the
config.json file to point at your own server instead of ours.

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
