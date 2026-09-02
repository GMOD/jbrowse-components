---
title: Hosted genomes and tracks for agents
sidebar_label: Hosted data
description:
  genomes.jbrowse.org publishes a ready-made JBrowse config per assembly, which
  an agent can discover, open, and add its own files to without authoring
  anything
---

An agent asked to "show me BRCA1 in human" can point at an assembly someone has
already published. [genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a
self-contained JBrowse `config.json` per assembly, covering the UCSC genome
browser databases and the UCSC GenArk assemblies. Each one is CORS-enabled and
needs no setup.

## What a hosted config contains

Fetch `https://jbrowse.org/ucsc/hg38/config.json` and you have, in one document:

- the **sequence**, as a remote 2bit
- **refName aliases**, so `1`, `chr1` and `NC_000001.11` resolve to the same
  contig and a file with the "wrong" naming style still lines up
- **cytobands**, which draw the ideogram in the overview
- a **track catalog**, the UCSC track set for that assembly, each with a
  `trackId` you can name
- for the UCSC databases, an **aggregate text-search index**, which makes a gene
  name work as a location

The GenArk assemblies carry the sequence, aliases and their own smaller track
set. A `GCF_` (RefSeq) assembly is usually annotated from the NCBI RefSeq GFF
and indexed, a `GCA_` (GenBank) one usually neither, so read
`aggregateTextSearchAdapters` out of the config when a gene name has to resolve.

### The URL scheme

Two shapes, and an agent can construct either without a lookup:

```
UCSC database    https://jbrowse.org/ucsc/<db>/config.json
                 e.g. hg38, hg19, mm39, hs1, danRer11

GenArk accession https://jbrowse.org/hubs/genark/<GCA|GCF>/<3>/<3>/<3>/<accession>/config.json
                 e.g. GCA_964188535.1 -> .../genark/GCA/964/188/535/GCA_964188535.1/config.json
```

- The GenArk path fans the first nine digits of the accession into three
  directories.
- The `--hub` flag on `@jbrowse/img` and `@jbrowse/capture` wraps the scheme, so
  there you name the assembly and never see the URL.
- `https://jbrowse.org/ucsc/all.json` is the union of the per-database configs,
  with **both** directions of every pairwise liftOver (`hg38_to_mm39_liftOver`
  and `mm39_to_hg38_liftOver`, each naming both assemblies). Use it for a
  session that spans two genomes, where a per-assembly config would have to
  resolve the second assembly at run time, and the per-assembly config
  otherwise, because `all.json` is every assembly's whole track list.

## Finding the assembly

- The UCSC databases are the small, familiar set (`hg38`, `mm39`, `danRer11` and
  a couple of hundred others), and `npx @jbrowse/img list` prints all of them
  with their organism.
- The GenArk assemblies are the long tail, tens of thousands of them.
  `https://genomes.jbrowse.org/searchIndex.json` is the index the Desktop start
  screen searches: one row per assembly, as a bare array.

```
[accession, commonName, scientificName, assemblyName, assemblyStatus,
 source, taxonId, ncbiStatusBits, year, ucscRank, altAccession]
```

```bash
curl -s https://genomes.jbrowse.org/searchIndex.json |
  jq -r '.[] | select((.[2]|ascii_downcase) | test("ambystoma mexicanum")) |
         "\(.[0])\t\(.[1])\t\(.[3])"'
```

```
GCA_002915635.3   axolotl (DD151 2021)             AmbMex60DD
GCF_040938575.1   axolotl (Mex_15411 2024 refseq)  UKY_AmexF1_1
GCA_040938575.1   axolotl (Mex_15411 2024 genbank) UKY_AmexF1_1
```

- The accession is the `--hub` name, and the config URL follows from it by the
  scheme above.
- It is one large file, so filter it with a tool rather than reading it into
  context.
- Two fields decide between near-duplicates: `source` is `ucsc` for a row that
  also has a UCSC database (use that db name instead, for the richer track set),
  and `ncbiStatusBits & 1` marks NCBI's designated reference for the species.

## Finding a track

```bash
## every track in one assembly, as trackId / type / name
npx @jbrowse/img list hg38

## just the ones matching a filter, on id or display name
npx @jbrowse/img list hg38 conservation
```

```
  hg38-phyloP30way      QuantitativeTrack   Basewise Conservation (phyloP) - 30-way vertebrate alignment
  hg38-phyloP100way     QuantitativeTrack   Basewise Conservation (phyloP) - 100-way vertebrate alignment
  hg38-phastCons30way   QuantitativeTrack   Element Conservation (phastCons) - 30-way vertebrates
  ...
```

- `npx @jbrowse/capture list hg38 <filter>` prints the same thing.
- With the config open in the app, `jb.listTracks(search)` is the same catalog.
- Hosted trackIds are prefixed with the assembly name (`hg38-clinvarMain`).
- Or read the config directly:

```bash
curl -s https://jbrowse.org/ucsc/hg38/config.json |
  jq -r '.tracks[] | select(.name | test("ClinVar"; "i")) | "\(.trackId)\t\(.type)\t\(.name)"'
```

## Opening a hosted assembly

- In JBrowse Desktop the `open` MCP tool takes the config URL directly, and
  JBrowse Web takes it as `?config=`. A session spec then builds the view, and a
  `loc` that is a gene name goes through the config's text index.
- As a link, `?config=` plus the [URL parameters](/docs/urlparams) is a complete
  view with nothing authored. `&tracks=` adds to the hub's own default session
  rather than replacing it, so the view opens with the tracks you named plus
  whichever the config already shows; a session spec gives exact control.
- `npx @jbrowse/capture url --hub hg38 --loc BRCA1 --track hg38-ncbiRefSeqCurated`
  builds that link, correctly encoded, without launching anything.

```
https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/ucsc/hg38/config.json&assembly=hg38&loc=BRCA1&tracks=hg38-ncbiRefSeqCurated,hg38-clinvarMain
```

As an image, with no browser at all:

```bash
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --track hg38-phyloP100way \
  --loc BRCA1 --width 1200 --out brca1.png
```

## Adding your own file to a hub

The hosted config supplies the assembly and the annotation context, and a
session spec's `sessionTracks` supplies your file. Nothing is authored to disk
and no assembly is built.

```json
{
  "sessionTracks": [
    {
      "type": "VariantTrack",
      "trackId": "my_variants",
      "name": "NA12878 phased variants",
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "VcfTabixAdapter",
        "uri": "https://jbrowse.org/genomes/hg38/NA12878/NA12878.whatshap.strandseq-pacbio-phasing.2017-07-19.vcf.gz"
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

- The view's `tracks` list mixes a hosted `trackId` with the one just defined.
- In the app the same object goes to `jb.loadSessionSpec`, and for one file with
  no spec `jb.addTrack({ location })` infers the track type from the extension.
- From a script,
  `npx @jbrowse/capture --hub hg38 --session spec.json -o mine.png` opens it, or
  `@jbrowse/capture url` prints it as a link.
- Your file must be reachable by the browser: a public URL with CORS enabled, or
  a local server.
- Its refNames must match the assembly, which is where the hub's alias table
  earns its place: a VCF using `1` works against a config whose contigs are
  `chr1`.

## Limits of the hosted hubs

- **The assembly is not there.** Non-model organisms outside GenArk, an
  unpublished assembly, a patched or custom reference. Build it with
  `jbrowse add-assembly` ([](/docs/quickstart_web)).
- **You need the tracks offline, or reproducibly pinned.** These are somebody
  else's servers and their contents change.
- **The hub's tracks resolve back to UCSC.** Many point at
  `hgdownload.soe.ucsc.edu`, so a slow or failing UCSC affects the view. If a
  script must be reliable, mirror the specific files it needs.
