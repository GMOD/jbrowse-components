# Take: two genomes, aligned on camera

The alignment the fly take had to give up on, at a genome size where it fits
inside a turn. _E. coli_ K-12 MG1655 against O157:H7 Sakai: minimap2 runs in
**3.3 s**, `make-pif` in **0.8 s**, and what comes out is a colinear backbone
plus 703 kb of Sakai that K-12 has nothing to align to — which turns out to be
the two Shiga toxin prophages and the LEE island.

```
node scripts/agent-demos/recordDemoMac.mjs out/ecoli scripts/agent-demos/takes/ecoli_synteny.mjs
```

`takes/synteny.mjs` and `takes/agent_synteny_page.mjs` are the fly versions of
the same analysis. The fly take was cut back to a supplied PAF in 2c2c6217b3
because whole-genome `asm10` on two 140 Mb genomes is 226 s at best and 447 s on
a loaded machine — longer than the turn cap, and the source of most of that
take's fragility. Here the aligner is 1/70th of that, so the thing the page is
about happens in frame.

## The pair

|               | K-12 MG1655                                               | O157:H7 Sakai                                             |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| accession     | GCF_000005845.2                                           | GCF_000008865.2                                           |
| chromosome    | NC_000913.3, 4,641,652 bp                                 | NC_002695.2, 5,498,578 bp                                 |
| plasmids      | none                                                      | NC_002128.1 (pO157, 92,721), NC_002127.1 (pOSAK1, 3,306)  |
| hosted config | `hubs/genark/GCF/000/005/845/GCF_000005845.2/config.json` | `hubs/genark/GCF/000/008/865/GCF_000008865.2/config.json` |

Both hosted configs are under `https://jbrowse.org/`, and each carries ten
tracks, of which `*-ncbiGene` is the one this take wants: a bigGenePred whose
names are real symbols (`eae`, `tir`, `stx2A`), not locus tags. Neither config
mentions the other strain, which is the premise.

The genark chromAlias makes the UCSC spellings (`NC_000913v3`, `NC_002695v2`)
canonical and the RefSeq accessions aliases, so a PAF written against the hub
FASTA names resolves either way — including in `displayedRegionNames`, which was
checked in both spellings.

## Before filming

Two FASTAs, 1.5 and 1.8 MB, about a second:

```bash
mkdir -p out/ecoli/cwd && cd out/ecoli/cwd
curl -sL -o k12.fa.gz https://hgdownload.soe.ucsc.edu/hubs/GCF/000/005/845/GCF_000005845.2/GCF_000005845.2.fa.gz
curl -sL -o sakai.fa.gz https://hgdownload.soe.ucsc.edu/hubs/GCF/000/008/865/GCF_000008865.2/GCF_000008865.2.fa.gz
```

Nothing else is pre-staged: the aligner, the index, the config and the views are
all the take's.

## What a good take does

**Turn one** aligns and opens. K-12 is the query, Sakai the target, so
`assemblyNames` on the adapter reads `[GCF_000005845.2, GCF_000008865.2]` in
that order:

```bash
minimap2 -t 8 -cx asm20 --cs sakai.fa.gz k12.fa.gz > k12_vs_sakai.paf   # 3.3 s, 83 records
jbrowse make-pif k12_vs_sakai.paf --out k12_vs_sakai.pif.gz             # 0.8 s, 203 kB + tbi
```

Then the two hosted configs merged with one `SyntenyTrack` over the PIF, and a
`LinearSyntenyView` with no `loc` for the whole-genome overview. **Leave the
hosted `aggregateTextSearchAdapters` out of the merge**: they carry a
`metaFilePath` key that no adapter declares, so `jbrowse validate` fails on the
merged config, and a take that navigates by coordinates has no use for them
anyway.

A gene track at whole-genome zoom draws nothing but a "Too many features" bar,
one per row, so the whole-genome view is better off with the genome rows empty —
`collapseEmptyRows: true` collapses them to their rulers and gives the ribbons
the frame. The gene tracks are what turn four wants, not turn one.

**Turn two** is a `DotplotView` on the same track with both axes restricted to
the chromosomes, which is what keeps Sakai's two plasmids off the y axis. It
draws one clean diagonal with a visible step up at every island — the picture
the third turn's numbers explain.

**Turn three** is read off the PAF. Aligned bases at MAPQ 30 or better total
**4.04 Mb** of K-12's 4.64, and the Sakai intervals with nothing aligned to them
are **19 of 10 kb or more, totalling 703 kb**. The preset does not change the
story:

| preset  | records | aligned | islands ≥10 kb | total  |
| ------- | ------- | ------- | -------------- | ------ |
| `asm5`  | 287     | 3.96 Mb | 25             | 841 kb |
| `asm10` | 130     | 4.02 Mb | 21             | 770 kb |
| `asm20` | 83      | 4.04 Mb | 19             | 703 kb |

**Turn four** names them off the Sakai gene track. The four biggest islands that
carry named genes, with the coordinates each preset agrees on to within 50 bp:

```
1,370,611 - 1,456,845   86 kb   ureABCDEFG, terZABCDEFW  (urease + tellurite resistance)
1,246,166 - 1,308,861   62 kb   stx2A, stx2B             (Shiga toxin 2 prophage)
2,896,004 - 2,943,920   47 kb   stx1A, stx1B             (Shiga toxin 1 prophage)
4,580,847 - 4,624,437   43 kb   eae, tir, map, esp*, esc*, ler, grlA, grlR  (LEE)
```

The LEE one is the shot. It is the whole pathogenicity island, it sits directly
after `selC` — the tRNA gene that is its textbook insertion site — and the K-12
junction is 3,836,175 / 3,837,978, a 1.8 kb gap. Framed as

```
K-12   NC_000913.3:3,820,000-3,855,000
Sakai  NC_002695.2:4,565,000-4,640,000
```

the ribbons run pink either side and open into a white wedge across the middle,
with `gmk spoT recG gltS xanP yicI yicH yicJ selC` in the same order on both
rows up to the junction and Sakai's type III secretion apparatus filling the
gap. An agent that answers with stx2 instead has the same data at a different
ranking and should say which it ranked by.

## Verified before this was written

| Claim                                               | How                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Both configs hosted, with a symbol-named gene track | fetched both; 10 tracks each, `*-ncbiGene` is a bigGenePred read directly and its names are `espF`, `escG`, `eae` |
| No alignment between them exists                    | neither config names the other strain                                                                             |
| The whole pipeline is seconds                       | 1.3 s download, 3.3 s `asm20` at `-t 8`, 0.8 s `make-pif`, on a machine at load 3                                 |
| The merged config validates                         | `products/jbrowse-cli/dist/bin.js validate`, once the text-search entries are dropped                             |
| Synteny, dotplot and the LEE zoom all draw          | captured against the repo `jbrowse-web` build through `products/jbrowse-capture`                                  |
| The islands are preset-robust                       | asm5/asm10/asm20 all put stx2, stx1 and LEE at the same coordinates ±50 bp                                        |
| The gene names are in the app, not just the GFF     | the bigBed's `geneName2` column, read straight off the hosted file                                                |

One thing that will mislead anyone checking this outside the repo: on the
**released** build at `jbrowse.org/code/jb2/latest` the dotplot does not
canonicalize the alignment's refNames, so a PIF written with RefSeq accessions
plots nothing against `NC_002695v2` axes and reports every feature as "not
plotted, fell outside of range" behind a warnings banner. The linear synteny
view of the same track draws fine, which makes it look like bad data rather than
a build difference. The repo build draws both.

## Open

- Not yet shot. Everything above is from the CLI and from captures of the repo
  web build; no take has been recorded.
- Whether turn four is better asked as "name them" or as "take me to the most
  interesting one" — the second gets the LEE shot on camera, the first risks
  ending on a list.
