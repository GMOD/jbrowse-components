---
title: Building a config with the CLI for Desktop
description:
  Assemble a config.json with the jbrowse CLI and open it in JBrowse Desktop
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

The [`@jbrowse/cli`](/docs/cli) lets you build a JBrowse configuration from the
command line instead of clicking through the **Add track** form. You run a few
commands and end up with one folder (a `config.json` sitting next to your data
files) that you can open directly in JBrowse Desktop _or_ serve on the web,
unchanged.

It works in both places because the CLI records each file by a path _relative_
to `config.json`: Desktop resolves those paths against the folder on disk, and a
web server resolves them against the served config's URL. So one scriptable,
reproducible setup is portable across both apps.

## Install the CLI

The CLI needs [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install -g @jbrowse/cli
jbrowse --version
```

## Prepare your files first

The CLI references and copies your data, but it does not compress or index it,
and JBrowse reads only indexed, compressed formats. So get each input into a
JBrowse-ready form first, using [samtools](http://www.htslib.org/) / htslib:

```bash
# reference FASTA: bgzip-compress, then index -> .fa.gz + .fa.gz.fai + .fa.gz.gzi
bgzip GRCh38.fa
samtools faidx GRCh38.fa.gz

# alignments: sort, then index -> sample.bam + sample.bam.bai
samtools sort reads.bam -o sample.bam
samtools index sample.bam

# variants: bgzip, then index -> variants.vcf.gz + variants.vcf.gz.tbi
bgzip variants.vcf
tabix -p vcf variants.vcf.gz
```

## Build the config directory

Point every command at the same output directory with `--out` (it is created if
it doesn't exist). The first `add-assembly` writes `myproject/config.json`; each
later command edits that same file in place.

```bash
# assembly: copies GRCh38.fa.gz and its .fai/.gzi index into myproject/
jbrowse add-assembly GRCh38.fa.gz --name hg38 --load copy --out myproject

# tracks: each copies the data file AND its index (.bai/.tbi/.csi) alongside
jbrowse add-track sample.bam --load copy --out myproject --name "My reads"
jbrowse add-track variants.vcf.gz --load copy --out myproject --name "My variants"
```

`--name hg38` is the assembly name you'll type into the location box; `--name`
on a track is its label in the track list.

`--load` says how the CLI places a local file relative to the config (omit it
for a remote URL, which is referenced in place):

| `--load`  | What it does                                                       |
| --------- | ------------------------------------------------------------------ |
| `copy`    | Copy the file (and its index) into the config directory.           |
| `move`    | Move it into the config directory.                                 |
| `symlink` | Symlink it into the config directory (no data duplicated).         |
| `inPlace` | Reference a file already staged in the directory; no file ops.     |
| _(omit)_  | For a remote `https://…` URL, referenced directly, nothing copied. |

Now `myproject/` is self-contained, with the config next to every file it needs:

```
myproject/
├── config.json
├── GRCh38.fa.gz  (+ .fa.gz.fai, .fa.gz.gzi)
├── sample.bam    (+ .bam.bai)
└── variants.vcf.gz  (+ .vcf.gz.tbi)
```

Inside `config.json`, the CLI referenced each file by its bare relative name
(you don't need to edit this, it's just what the CLI wrote):

```json
"adapter": {
  "type": "BamAdapter",
  "uri": "sample.bam",
  "index": { "location": { "uri": "sample.bam.bai" } }
}
```

## Open it in JBrowse Desktop

In JBrowse Desktop, choose **File → Open config.json or .jbrowse file…** (or the
**Open config.json or .jbrowse file** button on the start screen) and pick
`myproject/config.json`. Desktop resolves each relative path against the
config's own folder, loading the copied files straight from local disk, with no
web server and no re-adding tracks through the UI.

Since you already have a terminal open, you can also hand the config straight to
Desktop and skip the start screen entirely:

```sh
jbrowse-desktop myproject/config.json
```

(On macOS: `open -a "JBrowse 2" myproject/config.json`. See
[launching from the command line](/docs/quickstart_desktop#launching-from-the-command-line).)

(Prefer the GUI for a one-off file? Desktop's **Add track** picker still works.
This CLI route is best when you want a scripted, repeatable setup, or the same
config on both Desktop and the web.)

## Also use it on the web

The same config and data work on the web too. The relative paths resolve against
the served config's URL instead of a local folder. JBrowse Web is a separate
app, though, so serving `myproject/` on its own only hosts the files; you still
need the browser app. Two ways to get there:

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

- [CLI command reference](/docs/cli) - every `jbrowse` command and flag
- [Desktop quickstart](/docs/quickstart_desktop) - installing and using JBrowse
  Desktop
- [Web quickstart](/docs/quickstart_web) - serving a config directory on the web
- [Configuring assemblies](/docs/config_guides/assemblies) and
  [tracks](/docs/config_guides/tracks) - the config the CLI writes, by hand
