---
title: JBrowse CLI with Desktop
description:
  Assemble a config.json with the jbrowse CLI and open it in JBrowse Desktop
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

We build a genome browser configuration from the command line with
[`@jbrowse/cli`](/docs/cli): a few commands produce one folder, a `config.json`
next to your data files, which then opens in JBrowse Desktop and serves on the
web. The CLI records each file by a path _relative_ to `config.json`, so Desktop
resolves the paths against the folder on disk and a web server resolves them
against the served config's URL.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- JBrowse Desktop, or a web server if you want to serve the same folder

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

The CLI copies or references your data files as they are, and JBrowse reads
indexed, compressed files, so prepare each input first: a bgzipped and
`faidx`-indexed FASTA, a sorted and indexed BAM or CRAM, a bgzipped and tabixed
VCF, GFF3, or BED. The [web quickstart](/docs/quickstart_web#adding-tracks) has
the [samtools](http://www.htslib.org/) / htslib recipe per format, and the
commands below assume you have already run them.

## Build the config directory

Point every command at the same output directory with `--out`, which the CLI
creates if needed. The first `add-assembly` writes `myproject/config.json`, and
each later command edits that file in place. With `--load copy`, `add-assembly`
copies `GRCh38.fa.gz` and its `.fai`/`.gzi` index into `myproject/`, and each
`add-track` copies the data file and its `.bai`/`.tbi`/`.csi` index:

```bash
jbrowse add-assembly GRCh38.fa.gz --name hg38 --load copy --out myproject
jbrowse add-track sample.bam --load copy --out myproject --name "My reads"
jbrowse add-track variants.vcf.gz --load copy --out myproject --name "My variants"
```

`--name hg38` is the assembly name the session and the assembly selector use.
`--name` on a track is its label in the track list.

`--load` sets how the CLI places a local file relative to the config:

| `--load`  | What it does                                                       |
| --------- | ------------------------------------------------------------------ |
| `copy`    | Copy the file (and its index) into the config directory.           |
| `move`    | Move it into the config directory.                                 |
| `symlink` | Symlink it into the config directory (no data duplicated).         |
| `inPlace` | Reference a file already staged in the directory, no file ops.     |
| _(omit)_  | For a remote `https://…` URL, referenced directly, nothing copied. |

Now `myproject/` is self-contained, with the config next to every file it needs:

```text
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
filenames. `jq '.tracks[].trackId' myproject/config.json` prints them:

```json
{
  "name": "myproject",
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "hg38",
      "loc": "chr1:1-100,000",
      "tracks": ["sample", "variants.vcf"]
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
file...** (or the **Open file or link** button on the start screen) and pick
`myproject/config.json`. Desktop resolves each relative path against the
config's folder and loads the copied files from local disk, with no web server.

You can also hand the config straight to Desktop:

```sh
jbrowse-desktop myproject/config.json
```

(On macOS: `open -a "JBrowse 2" myproject/config.json`. See
[launching from the command line](/docs/quickstart_desktop#launching-from-the-command-line).)

<Figure src="/img/desktop-cli-config.png" caption="A CLI-built folder opened in JBrowse Desktop by path, with no start screen and no Add track form. The session name and the track labels come from the commands above, run on the volvox test genome."/>

Desktop resolves the relative `uri`s into absolute local paths for the renderer
and autosaves your work to a separate session file, so `config.json` keeps its
relative paths and the folder still serves on the web. A `.jbrowse` file, which
Desktop itself writes, saves in place.

## Serve the same folder on the web

On the web, the relative paths in `myproject/config.json` resolve against the
served config's URL. JBrowse Web is a separate app, so a served `myproject/`
needs a JBrowse Web instance alongside it, set up either way:

- Build into a JBrowse Web install: run `jbrowse create jbrowse2` first and pass
  `--out jbrowse2` on the commands above, so the app and your config sit in one
  served folder. The [web quickstart](/docs/quickstart_web) takes this route.
- Point an existing deployment at your config: host `myproject/` anywhere (e.g.
  `npx serve myproject`) and open your JBrowse Web instance with its URL
  appended: `https://your-jbrowse/?config=http://localhost:3000/config.json`.

## Index gene names for search

The project above has no gene track yet, so add one first:

```bash
jbrowse add-track genes.gff3.gz --load copy --out myproject
```

`text-index` then indexes its names into the same directory, and the location
box finds a gene by name:

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
