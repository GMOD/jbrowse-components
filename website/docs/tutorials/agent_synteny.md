---
title: Driving JBrowse with an AI agent (two Drosophila genomes)
sidebar_label: AI agent (two fly genomes)
description:
  Ask an AI agent, in plain words, to align two species that have no published
  alignment, build the views, and find where the two genomes run in opposite
  directions
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** four sentences typed at an AI agent, which aligns two fruit fly
species that nobody has aligned to each other, builds the comparison in JBrowse
Desktop, and answers where the two genomes run in opposite directions by
totalling up the alignment file rather than describing the picture. This page is
about what to ask for, what the agent does with it, and the two places it needs
telling.

## Prerequisites

- JBrowse Desktop, installed and running (see the
  [desktop quickstart](/docs/quickstart_desktop))
- an MCP client with a shell of its own: Claude Code, or Claude Desktop, set up
  as in [](/docs/agents)
- [minimap2](https://github.com/lh3/minimap2), which the agent runs
- `node`, for the [JBrowse CLI](/docs/cli), which the agent also runs

The agent needs a shell because the alignment happens outside the browser. A
client without one can still do everything after that step.

## Where the data comes from

Two GenArk assemblies and their hosted JBrowse configs. Each config carries the
2bit sequence, a chromAlias file, an NCBI RefSeq gene track and a Trix text
index, so neither assembly has to be described by hand.

- _D. simulans_ GCF_016746395.2 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/016/746/395/GCF_016746395.2/GCF_016746395.2.fa.gz
- _D. simulans_ hosted config:
  https://jbrowse.org/hubs/genark/GCF/016/746/395/GCF_016746395.2/config.json
- _D. mauritiana_ GCF_004382145.1 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/004/382/145/GCF_004382145.1/GCF_004382145.1.fa.gz
- _D. mauritiana_ hosted config:
  https://jbrowse.org/hubs/genark/GCF/004/382/145/GCF_004382145.1/config.json

## A question with no file behind it

_Drosophila simulans_ and _D. mauritiana_ are sister species. Both are already
hosted, so a browser opens either one on its own with genes and a working search
box. What neither config has is the other species: the only synteny track in
each is a liftOver to dm6, the _D. melanogaster_ reference.

So "show me these two side by side" cannot be answered by loading something.
Somebody has to align the genomes first, and that is the part of the job an
agent with a shell is for.

## What the agent is driving

Connected to JBrowse Desktop, the agent gets four tools, and only one of them is
interesting: `run_javascript` executes code against the live session, with a
helper library called `jb` as its standard library. `open`, `screenshot` and
`docs` cover the three things code inside the app cannot do. Everything below is
the agent writing code against the session you are watching.

The setup is in [](/docs/agents). Once the client lists your recent sessions,
the path works.

## Ask for the comparison

The first request is the whole pipeline, in one sentence:

```
Align D. simulans GCF_016746395.2 against D. mauritiana GCF_004382145.1,
then open both genomes in JBrowse side by side with their genes and the
alignment between them.
```

The agent fetches both genomes, then runs the aligner:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
## asm10 is the preset for assemblies up to about 10% divergence.
## --cs writes the difference string the index below carries.
minimap2 -t 8 -cx asm10 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
```

Whole genome against whole genome takes several minutes and about 8 GB of
memory, and produces 9,494 alignment records.

**This is where a tool call outlives its budget.** A `run_javascript` call has
about two minutes before it answers with a timeout while the app carries on
working, and the alignment is longer than that. An agent that has been told to
start long work in the background and check on it later handles this; one that
waits for the aligner inside a single call reports a failure that did not
happen. Saying so up front costs one sentence:

```
Run anything that takes minutes in the background and poll it.
```

Then it indexes the PAF, so the browser can read a region out of it instead of
parsing all of it:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
jbrowse make-pif sim_vs_mau.paf
```

and writes one config out of the two hosted ones, keeping each assembly's gene
track and adding the alignment as a synteny track. Merging the hosted configs is
shorter than declaring the assemblies by hand and keeps the chromAlias file and
the text index that were resolved already.

The one thing to check in what it wrote is the order of `assemblyNames` on the
adapter:

```json
"adapter": {
  "type": "PairwiseIndexedPAFAdapter",
  "pifGzLocation": { "localPath": "sim_vs_mau.pif.gz" },
  "assemblyNames": ["GCF_016746395.2", "GCF_004382145.1"]
}
```

Query first, target second, matching the `minimap2` argument order. Reversed, no
chromosome name resolves and the synteny band draws empty, which at whole-genome
zoom looks much like a genome pair with little in common.

## Ask for the dotplot

```
Add a dotplot of the same two assemblies underneath.
```

Both assemblies carry a few hundred unplaced scaffolds, and a dotplot that draws
them interleaves the axes with rows holding a handful of alignments each. Naming
the arms gives one diagonal instead:

```
Restrict both dotplot axes to chr2L, chr2R, chr3L, chr3R, chr4 and chrX.
```

The alias names work because the merged config kept each assembly's chromAlias
file. An agent that quantifies what restricting the axes drops, rather than just
doing it, is worth more than one that does not.

## Ask where they disagree

```
Where do the two genomes run in opposite directions? Answer from the
alignment file, not from the dotplot, and show me the numbers.
```

The last clause is the one that matters. A dotplot shows that two genomes are
mostly colinear, but a reverse-strand block a few hundred kilobases wide is a
few pixels at whole-genome zoom, and an agent asked to describe a picture will
describe it. The same information is in the PAF as numbers. Aligned bases per
arm, split by strand, at MAPQ 30 or better:

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

Grouping the reverse-strand blocks of 5 kb or more, and cutting a group wherever
half a megabase passes with none, gives three regions:

```
2R  sim    59,995 - 2,256,808  <->  mau   628,956 - 3,646,198   (2.20 Mb, 68 blocks)
X   sim 8,304,208 - 8,752,357  <->  mau 8,530,265 - 8,980,209   (0.45 Mb,  9 blocks)
X   sim 21,441,285 - 22,030,225 <->  mau 21,459,299 - 22,873,009 (0.59 Mb, 15 blocks)
```

The 2R region is the largest and the least tidy: 2.2 Mb at the centromere-
proximal end of the arm, in 68 short blocks because the sequence there is
repeat-rich. The two X regions are smaller and cleaner.

Ask which grouping it used. "The largest inversion" depends on how far apart two
blocks can be and still count as one region: at the half megabase above, 2R wins
on size and block count, and grouped more tightly 2R splits into clusters whose
largest is smaller than the X regions. Both answers are the same data.

## Ask to be taken there

```
Take the synteny view to the 2R region, with the gene tracks on.
```

The two rows navigate separately, to `chr2R:1-2,400,000` on simulans over
`chr2R:500,000-3,800,000` on mauritiana. The ribbons cross in the middle of the
band, and the genes on the two rows run in opposite directions through it.

## What you had to tell it

Three sentences, and each one is a failure that is quiet rather than loud:

- **Run long work in the background.** Otherwise a tool call times out over an
  aligner that is fine, and the agent reports a failure that did not happen.
- **Restrict the dotplot axes to the arms.** Otherwise a few hundred unplaced
  scaffolds interleave both axes.
- **Answer from the file, not the picture.** Otherwise you get a description of
  a dotplot, which cannot resolve the thing you asked about.

Two more are worth knowing because the agent hits them on its own. Ask it to
screenshot and read the image back after anything it builds: a wrong track id,
an empty region and a dropped setting all render as a plausible browser with
something missing. And ask it to say the numbers before it navigates, so what
you are looking at is a claim you can check.

## Without an agent

The same pipeline as a script, for a reader who wants the files rather than the
conversation:

```bash
curl -O https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_fly_agent_synteny.sh
bash build_fly_agent_synteny.sh fly_agent_synteny_build
```

It downloads both genomes, runs the alignment, indexes it, and writes
`config.json` to open in Desktop. It needs the tools in
[Prerequisites](#prerequisites), plus `jq` and `curl`.

## See also

- [](/docs/agents)
- [](/docs/agents_recipes)
- [](/docs/agents_live_model)
- [](/docs/tutorials/synteny_visualization)

## References

- Chakraborty M, et al. Evolution of genome structure in the _Drosophila
  simulans_ species complex. _Genome Research_ 31:380-396 (2021).
  https://doi.org/10.1101/gr.263442.120
- Li H. Minimap2: pairwise alignment for nucleotide sequences. _Bioinformatics_
  34:3094-3100 (2018). https://doi.org/10.1093/bioinformatics/bty191
