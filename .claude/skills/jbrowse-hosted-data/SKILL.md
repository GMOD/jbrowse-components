---
name: jbrowse-hosted-data
description:
  Use when a JBrowse task involves a genome that already exists publicly —
  human, mouse, zebrafish, any UCSC or GenArk assembly — or when you are about
  to download and index a reference genome, look up a gene's coordinates, or
  find an annotation track. Covers genomes.jbrowse.org: what is hosted, how to
  discover trackIds, how to open one, and how to put your own file on top of it
  without authoring a config.
---

# Hosted genomes and tracks

Before building an assembly, check whether it is already published.
[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a self-contained
JBrowse `config.json` per assembly, covering the UCSC genome browser databases
and the UCSC GenArk assemblies. Each is CORS-enabled and needs no setup.

Downloading and indexing hg38 to show a gene is the single most common way to
turn a two-minute task into an hour of bandwidth.

## What you get

One `config.json` carries the remote 2bit sequence, refName aliases (`1` /
`chr1` / `NC_000001.11` all resolve), cytobands for the ideogram, the UCSC track
catalog with a `trackId` each, and — for the UCSC databases — a text-search
index that makes a **gene name** work as a location.

GenArk assemblies carry sequence, aliases and their own smaller track set; not
all ship a text index. Check for `aggregateTextSearchAdapters` before relying on
a gene name.

## URL scheme

```
UCSC database     https://jbrowse.org/ucsc/<db>/config.json
GenArk accession  https://jbrowse.org/hubs/genark/<GCA|GCF>/<3>/<3>/<3>/<accession>/config.json
```

GenArk fans the first nine digits into three directories: `GCA_964188535.1` ->
`.../genark/GCA/964/188/535/GCA_964188535.1/config.json`. Both are wrapped by
the `--hub` flag below, so usually you name the assembly and never build the
URL.

## Find the assembly

`npx @jbrowse/img list` prints the couple of hundred UCSC databases. The GenArk
tail is tens of thousands, so search it instead —
`https://genomes.jbrowse.org/searchIndex.json`, one bare array per assembly:

```
[accession, commonName, scientificName, assemblyName, assemblyStatus,
 source, taxonId, ncbiStatusBits, year, ucscRank, altAccession]
```

```bash
curl -s https://genomes.jbrowse.org/searchIndex.json |
  jq -r '.[] | select((.[2]|ascii_downcase) | test("ambystoma mexicanum")) |
         "\(.[0])\t\(.[1])\t\(.[3])"'
# GCF_040938575.1   axolotl (Mex_15411 2024 refseq)  UKY_AmexF1_1
```

The accession is the `--hub` name; the config URL follows from the scheme above.
7.5 MB, so filter it with `jq` — do not read it into context. `source == "ucsc"`
means a UCSC db exists for that row; prefer the db name, its track set is
richer. `ncbiStatusBits & 1` marks NCBI's designated reference for the species.

## Find the track

```bash
npx @jbrowse/img list                  # every hosted UCSC assembly
npx @jbrowse/img list hg38             # its tracks: trackId / type / name
npx @jbrowse/img list hg38 clinvar     # filtered on id or display name
```

Or read the config directly:

```bash
curl -s https://jbrowse.org/ucsc/hg38/config.json |
  jq -r '.tracks[] | "\(.trackId)\t\(.type)\t\(.name)"'
```

trackIds are prefixed with the assembly (`hg38-clinvarMain`). **Do not guess
one** — a trackId that does not exist opens nothing and reports nothing.

## Open it

```bash
## a static image, no browser
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --width 1200 --out out.png

## a link
npx @jbrowse/capture url --hub hg38 --loc BRCA1 --track hg38-ncbiRefSeqCurated

## the real app, screenshotted once it has drawn
npx @jbrowse/capture --hub hg38 --loc BRCA1 --track hg38-ncbiRefSeqCurated -o out.png
```

The link is a plain
`?config=<hub config URL>&assembly=<name>&loc=<where>&tracks=<ids>` against any
JBrowse Web instance.

Two behaviours to know, because both mislead:

- **`&loc=` accepts a gene name** (via the text index). The `loc` field inside a
  **session spec** does not — it is parsed as a locstring and throws on a name.
  Symbol -> URL parameters; coordinates -> either.
- **`&tracks=` adds to the hub's own default session**, it does not replace it,
  so the view opens with your tracks plus whatever the config already showed.

## Your own file on top

The pattern that removes the slow step: hosted assembly and annotation, your
data as a session track, nothing written to disk.

```json
{
  "sessionTracks": [
    {
      "type": "VariantTrack",
      "trackId": "my_variants",
      "name": "My variants",
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "VcfTabixAdapter",
        "uri": "https://your-host/yours.vcf.gz"
      }
    }
  ],
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "hg38",
      "loc": "chr17:43,044,000-43,126,000",
      "tracks": ["hg38-ncbiRefSeqCurated", "my_variants"]
    }
  ]
}
```

```bash
npx @jbrowse/capture --hub hg38 --session spec.json -o mine.png
```

`assemblyNames` names the hub's assembly; the view's `tracks` mixes a hosted id
with the one just defined. Your file has to be reachable by the browser — a
public URL with CORS, or a local server. Pick the adapter type with
`jbrowse-authoring`'s `references/config-types.md`.

## When to build instead

- the assembly is not hosted (non-model organism outside GenArk, unpublished,
  patched or custom reference);
- you need the data offline or pinned — these are other people's servers;
- reliability matters and it matters more than setup time: the hub config lives
  on jbrowse.org but many of its tracks resolve back to
  `hgdownload.soe.ucsc.edu`.

Then use `jbrowse add-assembly` — see the `jbrowse-authoring` skill.

## Reference

- <https://jbrowse.org/jb2/docs/agents_hosted_data.md>
- <https://jbrowse.org/jb2/docs/tutorials/genomes_basics/> — the click-path
  version, for when a human has to drive it
- <https://jbrowse.org/jb2/docs/urlparams.md> — every parameter, including
  `&sessionTracks=` and `&hubURL=`
- <https://jbrowse.org/jb2/docs/jbrowse-img.md> — the static exporter
