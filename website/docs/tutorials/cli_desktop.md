---
title: Building a config with the CLI for Desktop
description:
  Use the jbrowse CLI to assemble a config.json plus local data files, then open
  it directly in JBrowse Desktop — the same config also serves on the web
guide_category: Tutorials
tutorial_category: Getting started
---

The [`@jbrowse/cli`](/docs/cli) builds a `config.json` — assemblies plus tracks
— in a directory, copying (or symlinking) your data files in next to it. That
one directory then works two ways:

- **JBrowse Desktop** opens the `config.json` straight off disk, and
- a **web** JBrowse serves the same directory over HTTP.

Because the CLI writes each track's location as a path **relative** to
`config.json`, the files resolve either way — against the config's folder on
Desktop, or against the served config URL on the web. So you get one scriptable,
reproducible setup instead of clicking through the **Add track** form, and it is
portable between the two apps.

## Install the CLI

```bash
npm install -g @jbrowse/cli
jbrowse --version
```

## Build the config directory

Point every command at the same output directory with `--out`. The first
`add-assembly` creates `myproject/config.json` if it doesn't exist yet; each
later command edits it in place.

```bash
# assembly: copies the FASTA and its .fai/.gzi index into myproject/
jbrowse add-assembly GRCh38.fa.gz --name hg38 --load copy --out myproject

# tracks: each copies the data file AND its index (.bai/.tbi/.csi) alongside
jbrowse add-track sample.bam --load copy --out myproject --name "My reads"
jbrowse add-track variants.vcf.gz --load copy --out myproject --name "My variants"
```

`--load` says how the CLI places a **local** file relative to the config (omit
it for a remote URL, which is referenced in place):

| `--load`  | What it does                                                        |
| --------- | ------------------------------------------------------------------- |
| `copy`    | Copy the file (and its index) into the config directory.            |
| `move`    | Move it into the config directory.                                  |
| `symlink` | Symlink it into the config directory (no data duplicated).          |
| `inPlace` | Reference a file already staged in the directory; no file ops.      |
| _(omit)_  | For a remote `https://…` URL — referenced directly, nothing copied. |

After the commands above, `myproject/` holds `config.json` next to
`GRCh38.fa.gz` (+ index), `sample.bam` (+ `.bai`), and `variants.vcf.gz` (+
`.tbi`). The track entries reference them by bare relative name, e.g.:

```json
"adapter": {
  "type": "BamAdapter",
  "uri": "sample.bam",
  "index": { "location": { "uri": "sample.bam.bai" } }
}
```

## Open it in JBrowse Desktop

In JBrowse Desktop, choose **File → Open session…** and pick
`myproject/config.json`. Desktop resolves each relative path against the
config's own folder, loading the copied files straight from local disk — no web
server, no re-adding tracks through the UI.

(Prefer the GUI for a one-off file? Desktop's **Add track** picker still works —
this CLI route shines when you want a scripted, repeatable setup, or the same
config on both Desktop and the web.)

## Serve the same directory on the web

The identical directory works unmodified in JBrowse Web — the relative paths now
resolve against the served config's URL:

```bash
npx serve myproject
# then open your web JBrowse at ?config=http://localhost:3000/config.json
```

or copy `myproject/` into your web server's document root and point `?config=`
at it. See the [web quickstart](/docs/quickstart_web) for a full deployment.

## Index gene names for search

To make the location box search by gene name, index the text of your gene tracks
— this also writes into the same directory:

```bash
jbrowse text-index --out myproject
```

## See also

- [CLI command reference](/docs/cli) — every `jbrowse` command and flag
- [Desktop quickstart](/docs/quickstart_desktop) — installing and using JBrowse
  Desktop
- [Web quickstart](/docs/quickstart_web) — serving a config directory on the web
- [Configuring assemblies](/docs/config_guides/assemblies) and
  [tracks](/docs/config_guides/tracks) — the config the CLI writes, by hand
