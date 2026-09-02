# Take: two assemblies, no chain file

Two sister species of fly that nobody has published an alignment between, put
side by side anyway: the agent aligns the genomes itself, indexes the result,
builds a config that carries both hosted assemblies and their gene tracks, and
then reads the alignment back to find the one region where the two genomes run
in opposite directions.

```
node scripts/agent-demos/agentDemo.mjs out/synteny scripts/agent-demos/takes/synteny.mjs
```

## The pair

Drosophila simulans GCF_016746395.2 and D. mauritiana GCF_004382145.1. Both are
GenArk assemblies with a hosted config at

```
https://jbrowse.org/hubs/genark/GCF/016/746/395/GCF_016746395.2/config.json
https://jbrowse.org/hubs/genark/GCF/004/382/145/GCF_004382145.1/config.json
```

Each config carries a 2bit sequence, a chromAlias file (so `2L`, `3R`, `X`
resolve against the `NC_` names the FASTA uses), NCBI RefSeq genes and a Trix
text index. Each has a liftOver to dm6 and neither has one to the other, which
is the premise of the take. Both genomes are five chromosome arms of 22 to 29 Mb
plus a small chromosome 4 and unplaced scaffolds.

| Arm | D. simulans | D. mauritiana |
| --- | ----------- | ------------- |
| 2L  | NC_052520.2 | NC_046667.1   |
| 2R  | NC_052521.2 | NC_046668.1   |
| 3L  | NC_052522.2 | NC_046669.1   |
| 3R  | NC_052523.2 | NC_046670.1   |
| 4   | NC_052524.2 | NC_046671.1   |
| X   | NC_052525.2 | NC_046672.1   |

## Before filming

Put the two FASTAs in `<outdir>/cwd` so the take does not spend its first minute
on a download the viewer learns nothing from:

```bash
mkdir -p out/synteny/cwd && cd out/synteny/cwd
curl -sL -o sim.fa.gz https://hgdownload.soe.ucsc.edu/hubs/GCF/016/746/395/GCF_016746395.2/GCF_016746395.2.fa.gz
curl -sL -o mau.fa.gz https://hgdownload.soe.ucsc.edu/hubs/GCF/004/382/145/GCF_004382145.1/GCF_004382145.1.fa.gz
```

43 MB and 47 MB. The alignment itself is the long step:

```bash
minimap2 -t 8 -cx asm10 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
```

Measured once, on a machine at load 30 to 130 from other work: 447 s wall, 1840
s CPU, 7.2 GB peak RSS, 9,494 PAF records. Idle, with all 16 threads, expect two
to three minutes. The encoder collapses a static app to 0.6 s, so the wait costs
nothing in the finished clip, but the MCP call timeout is 120 s: the agent has
to run the aligner in the shell, in the background, and poll. If a take needs to
be short, slicing one arm from each genome with `samtools faidx` cuts the work
by five; 2R and X are the arms with the answer.

`jbrowse make-pif sim_vs_mau.paf --out sim_vs_mau.pif.gz` takes 5 s and writes
the `.tbi` beside it. The merged config below passes
`products/jbrowse-cli/bin/run validate` (the installed `jbrowse` 4.1.15 has no
`validate`; the in-repo CLI does).

## What a good take does

**Turn one.** The two hosted configs already say everything about the
assemblies, so the config to open is the two of them merged plus one synteny
track, not something typed from scratch:

```bash
S=https://jbrowse.org/hubs/genark/GCF/016/746/395/GCF_016746395.2/config.json
M=https://jbrowse.org/hubs/genark/GCF/004/382/145/GCF_004382145.1/config.json
jq -n --slurpfile s <(curl -s $S) --slurpfile m <(curl -s $M) --arg pif "$PWD/sim_vs_mau.pif.gz" '
  ($s[0]) as $s | ($m[0]) as $m |
  {
    assemblies: ($s.assemblies + $m.assemblies),
    plugins: $s.plugins,
    aggregateTextSearchAdapters: ($s.aggregateTextSearchAdapters + $m.aggregateTextSearchAdapters),
    tracks: ([$s.tracks[], $m.tracks[]] | map(select(.trackId | endswith("ncbiRefSeq")))) + [{
      type: "SyntenyTrack",
      trackId: "sim_vs_mau",
      name: "D. simulans vs D. mauritiana (minimap2 asm10)",
      assemblyNames: ["GCF_016746395.2", "GCF_004382145.1"],
      adapter: {
        type: "PairwiseIndexedPAFAdapter",
        pifGzLocation: { localPath: $pif },
        index: { location: { localPath: ($pif + ".tbi") } },
        assemblyNames: ["GCF_016746395.2", "GCF_004382145.1"]
      }
    }]
  }' > config.json
```

`assemblyNames` on the adapter is query first, target second
(`website/docs/config/PairwiseIndexedPAFAdapter.md`), and in the minimap2 line
above the query is `sim.fa.gz`. Getting that backwards draws every ribbon to the
wrong row, and it looks fine at whole-genome zoom. Then the MCP `open` tool on
`config.json`, and a `LinearSyntenyView` spec with both assemblies and no `loc`
for the whole-genome view. `jbrowse add-assembly` and `add-track` reach the same
config; the merge is shorter and keeps the text index and aliases the hosted
configs already resolved.

**Turn two** is a `DotplotView` with the same two assemblies and the same track,
`colorBy: 'strand'` so reverse alignments have their own color, and
`autoDiagonalize: true` so the mauritiana axis follows the simulans one. The
layout is one `loadSessionSpec` with both views and

```json
"layout": { "direction": "vertical", "children": [{ "views": [0] }, { "views": [1] }] }
```

**Turn three** is read off the PAF, not the picture. Aligned bases by query arm,
target arm and strand, MAPQ 30 or better, from the alignment measured above:

```
27.0 Mb  3R -> 3R  +        1.03 Mb  2R -> 2R  -
22.6 Mb  3L -> 3L  +        0.93 Mb  X  -> X   -
22.1 Mb  2L -> 2L  +        0.39 Mb  3R -> 2R  +
20.1 Mb  X  -> X   +
19.5 Mb  2R -> 2R  +
```

The arms are colinear and the reverse strand is under 5% everywhere. Two arms
carry it, in two different shapes, and the dotplot shows both as blue against a
red diagonal:

```
D. simulans 2R    59,995 -  2,256,808  <->  D. mauritiana 2R    628,956 -  3,646,198   (2.2 Mb, 68 blocks of 5 kb or more, no forward block among them)
D. simulans X  8,412,821 -  8,752,357  <->  D. mauritiana X   8,530,265 -  8,869,423   (340 kb, blocks of 57 to 132 kb)
D. simulans X 21,604,635 - 21,885,769  <->  D. mauritiana X  22,512,673 - 22,788,933   (280 kb)
```

The 2R one is the largest, a single anti-diagonal over the centromere-proximal 2
Mb of the arm: target coordinates fall as query coordinates rise, and the
alignments are short because the region is repeat-rich. The X ones are small and
clean. "The inversion" in the question is the 2R one by size, and an agent that
answers X with the numbers has still read the file; a good take names both.
"Take me there" is the synteny view's two rows navigated to `chr2R:1-2,400,000`
over `chr2R:500,000-3,800,000`, or to the first X segment with about 200 kb of
flank so the forward ribbons frame the crossed ones. A reviewer should hear the
agent say the numbers before it navigates, and should see it use `awk` on the
PAF or `jb.getFeatures` on the track rather than describing the dotplot.

## Verified before this was written

| Claim                                | How                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Both configs hosted, genes plus Trix | fetched both; 19 tracks each, `TrixTextSearchAdapter`, chromAlias file     |
| No chain between them                | the only SyntenyTrack in each is `*_to_dm6_liftOver`                       |
| Whole-genome asm10 runs              | 447 s wall on a loaded machine, 9,494 records, 7.2 GB RSS                  |
| PIF builds                           | `jbrowse make-pif`, 5 s, 21 MB plus tbi                                    |
| The inversions are on 2R and X       | reverse-strand aligned bases per arm; the three segments listed above      |
| The config opens in Desktop          | `open` on the merged config, then the synteny and dotplot specs; both drew |

Two things the Desktop trial taught, both of which an agent will hit:

- **A whole-genome `loadSessionSpec` does not settle inside one call.** With the
  synteny view and the dotplot at whole-genome zoom, `jb.waitReady` was still
  waiting at 118 s and the call timed out while the app kept working. The agent
  has to park the promise on `globalThis` and return, then screenshot later; the
  views were fine.
- **Restrict the dotplot to the arms.** Without `displayedRegionNames` both axes
  interleave 350 unplaced scaffolds and the top third of the plot is a hairball
  of `Un_` rows. With
  `displayedRegionNames: ['chr2L','chr2R','chr3L','chr3R','chr4','chrX']` on
  both axes the plot is one diagonal, with the reverse-strand blocks legible as
  blue ticks at 2R and X. The alias names work there because the config carries
  the chromAlias file.

## Rehearsal, 2026-09-01

Shot once through the harness. `synteny-take1-transcript.txt` beside this file
is the record; the clip and poster are
`website/static/media/mcp/agent_synteny_take1.*` (69 s after `encode.mjs`).

| Turn                   | Wall  | Outcome                                                                                                                                               |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| side by side, no chain | 497 s | minimap2 in the background (226 s, 14 threads), a PAF to UCSC chain converter of its own, merged config, chain identity spot-checked against sequence |
| dotplot underneath     | 161 s | axes restricted to the six arms on its own initiative, after quantifying what that drops                                                              |
| the largest inversion  | 220 s | chrX 8.30 to 8.75 Mb against 8.53 to 8.98 Mb, monotone anti-diagonal verified at 97 to 98% identity, navigated                                        |

Two things to know before the next take:

- **"Chain file" was taken literally.** The agent wrote a PAF to chain converter
  and loaded the alignment through the chain adapter, not PIF. It worked, and it
  is arguably the more faithful answer to the words of the question. The turn
  now says "alignment", so the next take is free to use PIF.
- **It split 2R into pieces.** Its candidate list has the 2R region as five
  clusters of 90 to 360 kb separated by gaps, so the single largest cluster was
  the X one at 448 kb. The doc's answer of 2R as one 2.2 Mb inverted region and
  the agent's answer of X are the same data at two clustering widths; either is
  defensible on camera and the agent said why it chose.

## Open

- Time the alignment on an idle machine before deciding whole-genome versus one
  arm. The number above is a ceiling.
