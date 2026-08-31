---
title: Hosted genomes and tracks for agents
sidebar_label: Hosted data
description:
  genomes.jbrowse.org publishes a ready-made JBrowse config per assembly, which
  an agent can discover, open, and add its own files to without authoring
  anything
---

An agent asked to "show me BRCA1 in human" can point at an assembly someone has
already published.

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a self-contained
JBrowse `config.json` per assembly, covering the UCSC genome browser databases
and the UCSC GenArk assemblies. Each one is CORS-enabled and needs no setup at
all. This page is about reaching them from a script.

## What a hosted config contains

Fetch `https://jbrowse.org/ucsc/hg38/config.json` and you have, in one document:

- the **sequence**, as a remote 2bit — nothing to download or index;
- **refName aliases**, so `1`, `chr1` and `NC_000001.11` all resolve to the same
  contig and a file with the "wrong" naming style still lines up;
- **cytobands**, which is what draws the ideogram in the overview;
- a **track catalog** — the UCSC track set for that assembly, each with a
  `trackId` you can name;
- for the UCSC databases, an **aggregate text-search index**, which is what
  makes a gene name work as a location.

The GenArk assemblies carry the sequence, aliases and their own smaller track
set, and whether one ships a text index follows its accession: a `GCF_` (RefSeq)
assembly is annotated from the NCBI RefSeq GFF and indexed, a `GCA_` (GenBank)
one generally is neither. That is a prediction, not a guarantee, so read
`aggregateTextSearchAdapters` out of the config when a gene name has to resolve.

### The URL scheme

Two shapes, and an agent can construct either without a lookup:

```
UCSC database    https://jbrowse.org/ucsc/<db>/config.json
                 e.g. hg38, hg19, mm39, hs1, danRer11

GenArk accession https://jbrowse.org/hubs/genark/<GCA|GCF>/<3>/<3>/<3>/<accession>/config.json
                 e.g. GCA_964188535.1 -> .../genark/GCA/964/188/535/GCA_964188535.1/config.json
```

The GenArk path fans the first nine digits of the accession into three
directories. Both are wrapped by `hubUrl` in `@jbrowse/core/util/fetchHub`, and
by the `--hub` flag on the two command-line tools below, so most of the time you
name the assembly and never see the URL.

### One config with all the UCSC assemblies in it

`https://jbrowse.org/ucsc/all.json` is the union of the per-database configs:
every UCSC assembly declared in one document, each one's tracks, and **both**
directions of every pairwise liftOver. `hg38_to_mm39_liftOver` and
`mm39_to_hg38_liftOver` are both in it, each naming both assemblies.

That last part is the reason to reach for it. A per-assembly config declares one
assembly, so a synteny track naming a second one has to be resolved at run time
by the site's hub plugin. Against `all.json` both are already declared and
nothing has to resolve. It ships no `defaultSession`, so it opens on whatever
you point it at.

The cost is the fetch: it is every assembly's whole track list where a
per-assembly config is one assembly's. Use it for a session that spans two
genomes, and the per-assembly config otherwise.

## Finding the assembly

The UCSC databases are the small, familiar set — `hg38`, `mm39`, `danRer11` and
a couple of hundred others — and `npx @jbrowse/img list` prints all of them with
their organism.

The GenArk assemblies are the long tail, and there are tens of thousands, so
they need a search rather than a listing.
`https://genomes.jbrowse.org/searchIndex.json` is the index the Desktop start
screen searches: one row per assembly, as a bare array so the field names are
not repeated 50,000 times.

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

The accession is the `--hub` name, and the config URL follows from it by the
scheme above — the index records no URL of its own. It is a single 7.5 MB file,
so filter it server-side or cache it rather than reading it into context.

Two fields decide between near-duplicates: `source` is `ucsc` for a row that
also has a UCSC database (use that db name instead — it has the richer track
set), and `ncbiStatusBits & 1` marks NCBI's designated reference for the
species.

## Discovery of tracks

Three ways, cheapest first.

```bash
## every hosted UCSC assembly, with organism and description
npx @jbrowse/img list

## every track in one, as trackId / type / name
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

`npx @jbrowse/capture list hg38 <filter>` prints the same thing without the
rendering dependencies. Or fetch the config and read it directly, which is what
both of those do:

```bash
curl -s https://jbrowse.org/ucsc/hg38/config.json |
  jq -r '.tracks[] | select(.name | test("ClinVar"; "i")) | "\(.trackId)\t\(.type)\t\(.name)"'
```

Hosted trackIds are prefixed with the assembly name (`hg38-clinvarMain`).
`@jbrowse/img`'s `--track` fills the prefix in for you and, on a miss, errors
with the closest ids.

## Opening a hosted assembly

### As a link

`?config=` takes any config URL, so a hub plus the
[URL parameters](/docs/urlparams) is a complete view with nothing authored:

```
https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/ucsc/hg38/config.json&assembly=hg38&loc=BRCA1&tracks=hg38-ncbiRefSeqCurated,hg38-clinvarMain
```

Two things worth knowing about that URL:

- **`&loc=` accepts a gene name** because the hosted config carries a text
  index. `&loc=BRCA1` navigates to it. The equivalent field inside a
  [session spec](/docs/urlparams#session-spec) does **not** — a view's `loc` is
  parsed as a locstring and throws on a name — so reach for the URL parameters
  when you have a symbol and a spec when you have coordinates.
- **`&tracks=` adds to the hub's own default session** rather than replacing it,
  so the view opens with the tracks you named plus whichever the config already
  shows. Set `defaultSession` yourself, or use a session spec, if you need exact
  control.

`npx @jbrowse/capture url --hub hg38 --loc BRCA1 --track hg38-ncbiRefSeqCurated`
builds that link for you, correctly encoded, without launching anything.

### As an image

```bash
## no browser at all: server-side React renders straight to PNG or SVG
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --track hg38-phyloP100way \
  --loc BRCA1 --width 1200 --out brca1.png
```

Full flag reference in [](/docs/jbrowse-img). For the real app instead of a
static render, see [](/docs/agents_capture).

### In a notebook

`fetch_hub` takes the same names:

```python
from jbrowse_anywidget import LinearGenomeView, fetch_hub

view = LinearGenomeView(assembly=fetch_hub("hg38"), location="chr17:43,044,000-43,126,000")
view
```

See [](/docs/jbrowse_anywidget).

## Adding your own file to a hub

This is the pattern worth learning, because it removes the slowest step in the
loop: a hosted config supplies the assembly and the annotation context, and a
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

The view's `tracks` list mixes a hosted `trackId` with the one just defined, and
`assemblyNames` refers to the hub's assembly by name. Open it against the hub:

```bash
npx @jbrowse/capture --hub hg38 --session spec.json -o mine.png
```

or as a link, by URL-encoding the JSON after `&session=spec-`
(`@jbrowse/capture url --hub hg38 --session spec.json` prints it).
`&sessionTracks=` is the URL-parameter equivalent for a one-off — see
[](/docs/urlparams#sessiontracks).

Your file must be reachable by the browser: a public URL with CORS enabled, or a
local server. Its refNames must match the assembly, which is where the hub's
alias table earns its place — a VCF using `1` works against a config whose
contigs are `chr1`.

## Limits of the hosted hubs

- **The assembly is not there.** Non-model organisms outside GenArk, an
  unpublished assembly, a patched or custom reference. Build it —
  [](/docs/quickstart_web) covers `jbrowse add-assembly`.
- **You need the tracks offline, or reproducibly pinned.** These are somebody
  else's servers and their contents change.
- **The hub's tracks resolve back to UCSC.** The config lives on jbrowse.org but
  many of its tracks point at `hgdownload.soe.ucsc.edu`, so a slow or failing
  UCSC affects the view. If a script must be reliable, mirror the specific files
  it needs.

## See also

- [](/docs/tutorials/genomes_basics), the same catalog driven by clicking rather
  than by URL, which is the page to send a human to
- [](/docs/agents) — the loop this fits into
- [](/docs/agents_capture) — turning one of these views into an image
- [](/docs/jbrowse-img) — the full static-export reference
- [](/docs/urlparams) — every parameter, including `sessionTracks` and `hubURL`
