---
title: Synteny with an AI agent (two Drosophila genomes)
sidebar_label: Synteny (with an AI agent)
description:
  Align two sister species that have no published alignment between them, then
  drive JBrowse Desktop with an AI agent to build the views and find where the
  two genomes run in opposite directions
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** two fruit fly species that nobody has aligned to each other, aligned
here with `minimap2`, then handed to an AI agent driving JBrowse Desktop over
its MCP server. The agent builds the comparison, and answers where the two
genomes run in opposite directions by reading the alignment file rather than the
picture. Four of the six chromosome arms are colinear; 2R and X are not.

## Prerequisites

- JBrowse Desktop, installed and running (see the
  [desktop quickstart](/docs/quickstart_desktop))
- an MCP client pointed at it: Claude Desktop or Claude Code, set up as in
  [](/docs/agents)
- [minimap2](https://github.com/lh3/minimap2)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu `apt install minimap2 jq` covers the aligner and the JSON tool
the build script uses; `node` comes from [nodejs.org](https://nodejs.org/).

## Where the data comes from

Two GenArk assemblies and their hosted JBrowse configs. Each config carries the
2bit sequence, a chromAlias file, an NCBI RefSeq gene track and a Trix text
index.

- _D. simulans_ GCF_016746395.2 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/016/746/395/GCF_016746395.2/GCF_016746395.2.fa.gz
- _D. simulans_ hosted config:
  https://jbrowse.org/hubs/genark/GCF/016/746/395/GCF_016746395.2/config.json
- _D. mauritiana_ GCF_004382145.1 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/004/382/145/GCF_004382145.1/GCF_004382145.1.fa.gz
- _D. mauritiana_ hosted config:
  https://jbrowse.org/hubs/genark/GCF/004/382/145/GCF_004382145.1/config.json

## Two species with nothing joining them

_Drosophila simulans_ and _D. mauritiana_ are sister species, close enough that
an assembly-to-assembly aligner handles them in one pass. Both are already
hosted, so a genome browser can open either one on its own with genes and a
working search box.

What neither config has is the other species. The only synteny track in each is
a liftOver to dm6, the _D. melanogaster_ reference:

```bash
curl -s https://jbrowse.org/hubs/genark/GCF/016/746/395/GCF_016746395.2/config.json |
  jq -r '.tracks[] | select(.type == "SyntenyTrack") | .trackId'
```

```
GCF_016746395.2_to_dm6_liftOver
```

So the comparison this page makes does not exist yet in any public file. It has
to be computed first, and that is the part a browser cannot do for you.

## Aligning the two genomes

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
## asm10 is the preset for assemblies up to about 10% divergence.
## --cs writes the difference string the index below carries.
minimap2 -t 8 -cx asm10 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
```

Whole genome against whole genome takes several minutes and about 8 GB of
memory, and produces 9,494 alignment records. **The query comes first in the
output and second on the command line**, which is the order every later step has
to agree with.

Indexing the PAF gives a file the browser can read a region out of instead of
parsing all of it:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
jbrowse make-pif sim_vs_mau.paf
```

That writes `sim_vs_mau.pif.gz` and its `.tbi` beside the input, in a couple of
seconds.

## One config out of the two hosted ones

Both assemblies are already described by their hosted configs, down to the
chromAlias file that makes `2L`, `3R` and `X` resolve against the `NC_` names
the FASTA uses. Merging the two is shorter than declaring either assembly by
hand, and it keeps the aliases and the text index that were resolved already:

```bash
jq -n --slurpfile s sim_hub.json --slurpfile m mau_hub.json \
  --arg pif "$PWD/sim_vs_mau.pif.gz" '
  ($s[0]) as $s | ($m[0]) as $m |
  {
    assemblies: ($s.assemblies + $m.assemblies),
    tracks: ([$s.tracks[], $m.tracks[]]
      | map(select(.trackId | endswith("ncbiRefSeq")))) + [{
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

`assemblyNames` on the adapter is query first, target second, matching the
`minimap2` argument order. Reversed, no chromosome name resolves, the synteny
band draws empty, and at whole-genome zoom that looks much like a genome pair
with little in common. The full script is in
[Reproduce it end to end](#reproduce-it-end-to-end).

## Handing it to the agent

With an MCP client connected to JBrowse Desktop, the config is one tool call
away, and everything after it is a request in plain words:

```
Open /path/to/config.json.
Put the two assemblies in a synteny view with their gene tracks, whole genome.
Add a dotplot of the same two assemblies underneath.
```

Two things are worth saying up front, because both fail quietly rather than
loudly.

**A whole-genome session does not finish building inside one tool call.** Both
views resolving two assemblies and a synteny track runs past the two-minute
budget a call gets. An agent that waits for it in one call gets a timeout while
the app carries on working. Telling it to start the load, return, and check
again on the next call avoids a confusing failure that is not a failure.

**Restrict the dotplot to the chromosome arms.** Both assemblies carry a few
hundred unplaced scaffolds, and a dotplot that draws them interleaves the axes
with rows that hold a few alignments each. Naming the arms gives one diagonal
instead:

```
Set the dotplot's displayed regions on both axes to
chr2L, chr2R, chr3L, chr3R, chr4 and chrX.
```

The alias names work because the merged config kept each assembly's chromAlias
file.

## Reading the answer out of the alignment

A dotplot is a good way to see that two genomes are mostly colinear. It is not
where the answer to "where do they disagree" should come from, because a
reverse-strand block a few hundred kilobases wide is a few pixels at
whole-genome zoom. The alignment file has the same information as numbers, and
an agent with a shell can total it up. Aligned bases per arm, split by strand,
counting only alignments at MAPQ 30 or better:

```bash
awk -F'\t' '
BEGIN {
  ## the arm each RefSeq accession is, from the chromAlias files
  split("NC_052520.2 2L NC_052521.2 2R NC_052522.2 3L NC_052523.2 3R NC_052524.2 4 NC_052525.2 X", a, " ")
  split("NC_046667.1 2L NC_046668.1 2R NC_046669.1 3L NC_046670.1 3R NC_046671.1 4 NC_046672.1 X", b, " ")
  for (i = 1; i in a; i += 2) q[a[i]] = a[i+1]
  for (i = 1; i in b; i += 2) t[b[i]] = b[i+1]
}
## $12 is MAPQ, $5 the strand, $4-$3 the aligned length on the query
$12 >= 30 && ($1 in q) && ($6 in t) && q[$1] == t[$6] {
  aligned[q[$1]] += $4 - $3
  if ($5 == "-") reverse[q[$1]] += $4 - $3
}
END {
  for (k in aligned)
    printf "%-3s %6.2f Mb aligned, %5.2f%% reverse\n", k, aligned[k]/1e6, 100*reverse[k]/aligned[k]
}' sim_vs_mau.paf | sort
```

```
2L   22.15 Mb aligned,  0.28% reverse
2R   20.56 Mb aligned,  5.02% reverse
3L   22.56 Mb aligned,  0.03% reverse
3R   27.03 Mb aligned,  0.01% reverse
4     1.10 Mb aligned,  0.00% reverse
X    21.04 Mb aligned,  4.44% reverse
```

Four arms carry essentially no reverse-strand alignment, which is what two
genomes assembled in the same orientation look like. Those four are the control
for the other two: 2R and X sit more than an order of magnitude above them.

## The two arms that disagree

Grouping the reverse-strand blocks of 5 kb or more, and cutting a group wherever
half a megabase passes with none, gives three regions:

```
2R  sim    59,995 - 2,256,808  <->  mau   628,956 - 3,646,198   (2.20 Mb, 68 blocks)
X   sim 8,304,208 - 8,752,357  <->  mau 8,530,265 - 8,980,209   (0.45 Mb,  9 blocks)
X   sim 21,441,285 - 22,030,225 <->  mau 21,459,299 - 22,873,009 (0.59 Mb, 15 blocks)
```

The 2R region is the largest and the least tidy: 2.2 Mb at the centromere-
proximal end of the arm, broken into 68 short blocks because the sequence there
is repeat-rich. The two X regions are smaller and cleaner, a handful of blocks
each.

Which one is "the largest inversion" depends on how far apart two blocks can be
and still count as one region. At the half-megabase gap used above, 2R wins on
both size and block count. Group more tightly and 2R splits into several
clusters, the largest of which is smaller than the X regions. An agent asked for
the largest inversion can reasonably answer either, and the useful thing to ask
it for is the grouping it used.

To look at one, the synteny view navigates each row separately:

```
Take the synteny view to chr2R:1-2,400,000 on simulans
over chr2R:500,000-3,800,000 on mauritiana.
```

The ribbons cross in the middle of the band, and the gene tracks on the two rows
run in opposite directions through the region.

## Reproduce it end to end

```bash
curl -O https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_fly_agent_synteny.sh
bash build_fly_agent_synteny.sh fly_agent_synteny_build
```

The script downloads both genomes, runs the alignment, indexes it, and writes
`config.json`. It needs the tools in [Prerequisites](#prerequisites), plus `jq`
and `curl`. The alignment dominates the runtime; everything else takes seconds.

## See also

- [](/docs/agents)
- [](/docs/agents_recipes)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)

## References

- Chakraborty M, et al. Evolution of genome structure in the _Drosophila
  simulans_ species complex. _Genome Research_ 31:380-396 (2021).
  https://doi.org/10.1101/gr.263442.120
- Li H. Minimap2: pairwise alignment for nucleotide sequences. _Bioinformatics_
  34:3094-3100 (2018). https://doi.org/10.1093/bioinformatics/bty191
