---
title: JBrowse CLI with Desktop
description:
  Assemble a config.json with the jbrowse CLI and open it in JBrowse Desktop
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

**TL;DR:** build a `config.json` from the command line with `@jbrowse/cli`. It
records each data file by a path relative to the config, so the same folder
opens in JBrowse Desktop or served on the web, and Desktop leaves the config it
opens alone.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- JBrowse Desktop, or a web server if you want to serve the same folder

## One folder that opens in either app

The [`@jbrowse/cli`](/docs/cli) builds a JBrowse configuration from the command
line. A few commands produce one folder, a `config.json` sitting next to your
data files, that you can open directly in JBrowse Desktop _or_ serve on the web.

It works in both places because the CLI records each file by a path _relative_
to `config.json`: Desktop resolves those paths against the folder on disk, and a
web server resolves them against the served config's URL.

## Install the CLI

Install Node.js from [NodeSource](https://github.com/nodesource) or
[NVM](https://github.com/nvm-sh/nvm); the `apt` packages tend to be old.

```bash
npm install -g @jbrowse/cli
jbrowse --version
```

To avoid a global install, replace `jbrowse` with `npx @jbrowse/cli` in any
command below.

## Prepare your files first

The CLI references and copies your data without compressing or indexing it, and
JBrowse reads only indexed, compressed formats, so get each input into a
JBrowse-ready form first: a bgzipped and `faidx`-indexed FASTA, a sorted and
indexed BAM or CRAM, a bgzipped and tabixed VCF, GFF3, or BED. The
[web quickstart](/docs/quickstart_web#adding-tracks) has the
[samtools](http://www.htslib.org/) / htslib recipe per format, and the commands
below assume you have already run them.

## Build the config directory

Point every command at the same output directory with `--out` (it is created if
it doesn't exist). The first `add-assembly` writes `myproject/config.json`, and
each later command edits that same file in place.

```bash
# assembly: copies GRCh38.fa.gz and its .fai/.gzi index into myproject/
jbrowse add-assembly GRCh38.fa.gz --name hg38 --load copy --out myproject

# tracks: each copies the data file AND its index (.bai/.tbi/.csi) alongside
jbrowse add-track sample.bam --load copy --out myproject --name "My reads"
jbrowse add-track variants.vcf.gz --load copy --out myproject --name "My variants"
```

`--name hg38` is the assembly name the session and the assembly selector use.
`--name` on a track is its label in the track list.

`--load` says how the CLI places a local file relative to the config (omit it
for a remote URL, which is referenced in place):

| `--load`  | What it does                                                       |
| --------- | ------------------------------------------------------------------ |
| `copy`    | Copy the file (and its index) into the config directory.           |
| `move`    | Move it into the config directory.                                 |
| `symlink` | Symlink it into the config directory (no data duplicated).         |
| `inPlace` | Reference a file already staged in the directory, no file ops.     |
| _(omit)_  | For a remote `https://…` URL, referenced directly, nothing copied. |

Now `myproject/` is self-contained, with the config next to every file it needs:

```
myproject/
├── config.json
├── GRCh38.fa.gz  (+ .fa.gz.fai, .fa.gz.gzi)
├── sample.bam    (+ .bam.bai)
└── variants.vcf.gz  (+ .vcf.gz.tbi)
```

Inside `config.json`, the CLI referenced each file by its bare relative name:

```json
"adapter": {
  "type": "BamAdapter",
  "bamLocation": { "uri": "sample.bam", "locationType": "UriLocation" },
  "index": {
    "location": { "uri": "sample.bam.bai", "locationType": "UriLocation" },
    "indexType": "BAI"
  }
}
```

## Open on a view by default

A config with tracks but no session opens on the view chooser: the assembly and
tracks are loaded, but nothing is displayed until you launch a view and tick
them in the track selector. To have the folder open ready to read, write the
session you want and hand it to the CLI. `assembly` is the `--name` you gave
`add-assembly`, and `tracks` takes the `trackId`s the CLI derived from your
filenames, which are in `config.json`:

```json
{
  "name": "myproject",
  "views": [
    {
      "type": "LinearGenomeView",
      "init": {
        "assembly": "hg38",
        "loc": "chr1:1-100,000",
        "tracks": ["sample", "variants.vcf"]
      }
    }
  ]
}
```

```bash
jbrowse set-default-session --session session.json --out myproject
```

`session.json` itself stays outside the folder; the CLI copies its contents into
`config.json`.

## Open the folder in JBrowse Desktop

In JBrowse Desktop, choose **File → Session → Open config.json or .jbrowse
file...** (or the **Open .jbrowse or config.json or link** button on the start
screen) and pick `myproject/config.json`. Desktop resolves each relative path
against the config's own folder, loading the copied files straight from local
disk with no web server.

You can also hand the config straight to Desktop:

```sh
jbrowse-desktop myproject/config.json
```

(On macOS: `open -a "JBrowse 2" myproject/config.json`. See
[launching from the command line](/docs/quickstart_desktop#launching-from-the-command-line).)

<Figure src="/img/desktop-cli-config.png" caption="A CLI-built folder opened in JBrowse Desktop by path, with no start screen and no Add track form. The session name, the assembly and the track labels all come from the commands above."/>

Desktop does not save back into a `config.json` it opens. It resolves the
relative `uri`s into absolute local paths for the renderer, then starts a
session of its own and autosaves there, so the folder you built stays portable
and still serves on the web. A `.jbrowse` file, which is one Desktop itself
wrote, does save in place.

## Serve the same folder on the web

The same config and data work on the web too, with the relative paths resolving
against the served config's URL. JBrowse Web is a separate app, so a served
`myproject/` needs a JBrowse Web instance alongside it. Two ways to get there:

- Build into a JBrowse Web install: run `jbrowse create jbrowse2` first and pass
  `--out jbrowse2` on the commands above, so the app and your config live in one
  served folder. This is exactly the [web quickstart](/docs/quickstart_web).
- Point an existing deployment at your config: host `myproject/` anywhere (e.g.
  `npx serve myproject`) and open your JBrowse Web instance with its URL
  appended: `https://your-jbrowse/?config=http://localhost:3000/config.json`.

## Index gene names for search

To make the location box search by gene name, index the text of your gene
tracks. This also writes into the same directory:

```bash
jbrowse text-index --out myproject
```

## See also

- [](/docs/tutorials/display_settings)
- [](/docs/tutorials/embed_linear_genome_view)
- [](/docs/cli)
- [](/docs/quickstart_desktop)
- [](/docs/quickstart_web)
- [](/docs/config_guides/assemblies)
