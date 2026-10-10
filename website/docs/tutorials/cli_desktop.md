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

## Prepare indexed, compressed data files

The CLI copies or references your data files as they are, and JBrowse reads
indexed, compressed files, so prepare each input first: a bgzipped and
`faidx`-indexed FASTA, a sorted and indexed BAM or CRAM, a bgzipped and tabixed
VCF, GFF3, or BED. The [web quickstart](/docs/quickstart_web#adding-tracks) has
the [samtools](http://www.htslib.org/) / htslib recipe per format, and the
commands below assume you have already run them.

## Build a config directory with add-assembly and add-track

Point every command at the same output directory with `--out`, which the CLI
creates if needed. The first `add-assembly` writes `myproject/config.json`, and
each later command edits that file in place:

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

`myproject/` is now self-contained:

```text
myproject/
├── config.json
├── GRCh38.fa.gz  (+ .fa.gz.fai, .fa.gz.gzi)
├── sample.bam    (+ .bam.bai)
└── variants.vcf.gz  (+ .vcf.gz.tbi)
```

<details>
<summary>What the CLI wrote into config.json: each file by its bare relative name</summary>

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

</details>

## Open the folder on a default view with a session

A config with tracks but no session displays nothing until you launch a view and
tick tracks in the selector. To open the folder ready to read, write a session
and hand it to the CLI. In the session:

- **`assembly`** is the `--name` you gave `add-assembly`
- **`tracks`** takes the `trackId`s the CLI derived from your filenames;
  `jq '.tracks[].trackId' myproject/config.json` prints them

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

`session.json` stays outside the folder, and the CLI copies its contents into
`config.json`. `jbrowse validate myproject/config.json` reports a misspelled key
that JBrowse would otherwise ignore.

## Open the CLI-built folder in JBrowse Desktop

Choose **File → Session → Open config.json or .jbrowse file...** in JBrowse
Desktop (or use the **Open file or link** button on the start screen) and pick
`myproject/config.json`. Desktop resolves each relative path against the
config's folder and loads the copied files from local disk, with no web server.

You can also hand the config straight to Desktop:

```sh
jbrowse-desktop myproject/config.json
```

(On macOS: `open -a "JBrowse 2" myproject/config.json`. See
[launching from the command line](/docs/quickstart_desktop#launching-from-the-command-line).)

<Figure src="/img/desktop-cli-config.png" caption="A CLI-built folder opened in JBrowse Desktop by path, with no start screen and no Add track form. The session name and the track labels come from the commands above, run on the volvox test genome."/>

Desktop autosaves your work to a separate session file, and a `.jbrowse` file,
which Desktop itself writes, saves in place.

## Serve the config folder on the web

JBrowse Web is a separate app, so a served `myproject/` needs a JBrowse Web
instance alongside it, set up either way:

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

`jbrowse text-index` then indexes the gene names into the same directory, and
the location box finds a gene by name:

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
