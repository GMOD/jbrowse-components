---
title: Driving JBrowse with an AI agent (two Drosophila genomes)
sidebar_label: AI agent (two fly genomes)
description:
  Ask an AI agent, in plain words, to align two species that have no published
  alignment, build the views, and find where the two genomes run in opposite
  directions
guide_category: Tutorials
tutorial_category: Automation
---

Four sentences typed at an AI agent are enough to align two fruit fly species
that nobody has aligned to each other, build the comparison in JBrowse Desktop,
and answer where the two genomes run in opposite directions by totalling up the
alignment file rather than describing the picture. The sections below cover what
to ask for, what the agent does with it, and the two places it needs telling.

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
- the alignment the figures below open, indexed and rehosted:
  https://jbrowse.org/demos/fly_agent_synteny/sim_vs_mau.pif.gz beside the
  merged config at https://jbrowse.org/demos/fly_agent_synteny/config.json

## Why this needs a shell

_Drosophila simulans_ and _D. mauritiana_ are sister species. Both are already
hosted, so a browser opens either one on its own with genes and a working search
box. Neither config has the other species: the only synteny track in each is a
liftOver to dm6, the _D. melanogaster_ reference.

Neither hosted config can answer "show me these two side by side" by loading
something. Somebody has to align the genomes first, and that is the part of the
job an agent with a shell is for.

## What the agent is driving

Connected to JBrowse Desktop, the agent gets four tools, and only one of them is
interesting: `run_javascript` executes code against the live session, with a
helper library called `jb` as its standard library. `open`, `screenshot` and
`docs` cover the three things code inside the app cannot do. Everything below is
the agent writing code against the session you are watching.

The setup is in [](/docs/agents). Once the client lists your recent sessions,
the path works. Run the four requests below and the app moves under you like
this, the captions being what the agent said as it went:

<Video src="/media/mcp/agent_synteny_take1.mp4" caption="A Claude Code session driving JBrowse Desktop, filmed against the app window. The agent aligns the two genomes, merges the two hosted configs, builds the comparison and the dotplot, totals the alignment file and navigates to what it found." />

## Ask for the comparison

The first request is the whole pipeline, in one sentence:

```text
Align D. simulans GCF_016746395.2 against D. mauritiana GCF_004382145.1 with
minimap2. Run it in the background and poll it, and when it is done index it
and open both genomes side by side, with their gene tracks and the alignment
between them.
```

The aligner it runs:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
## The largest chromosome measures 2.4% divergence (de:f), past asm10's 1%.
## --cs writes the difference string the index below carries.
minimap2 -t 8 -cx asm20 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
```

Whole genome against whole genome takes about seven minutes on 16 threads and 14
GB of memory, and produces 6,663 alignment records.

**This is where a tool call exceeds its time budget.** A `run_javascript` call
has about two minutes before it answers with a timeout while the app carries on
working, and the alignment is longer than that. An agent that puts the aligner
in the background and polls it handles this; one that waits for it inside a
single call reports a failure that did not happen. The phrase "in the
background" in the request above tells the agent to do that.

The alignment should finish before anything opens. Two genomes side by side with
nothing between them look like the finished comparison, and an alignment that
appears afterwards reads as a correction.

Indexing the PAF lets the browser read a region out of it instead of parsing all
of it:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
jbrowse make-pif sim_vs_mau.paf
```

The config it builds is the two hosted ones merged, keeping each assembly's gene
track and adding the alignment as a synteny track. Merging them is shorter than
declaring the assemblies by hand and keeps the chromAlias file and the text
index that were resolved already.

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

<Figure caption="Thirty kilobases of chr3R on both genomes: NCBI RefSeq on each row, the minimap2 alignment between them, colored red where the two run in the same direction. One block spans the window, and each gene meets its counterpart exon for exon." src="/img/agent_synteny/comparison_built.png" />

## Ask for the dotplot

```text
Add a dotplot of the same two assemblies underneath.
```

_D. simulans_ and _D. mauritiana_ each carry a few hundred unplaced scaffolds,
and a dotplot that draws them interleaves the axes with rows holding a handful
of alignments each. Naming the arms gives one diagonal:

```text
Restrict both dotplot axes to chr2L, chr2R, chr3L, chr3R, chr4 and chrX.
```

The alias names work because the merged config kept each assembly's chromAlias
file. Ask it to quantify what restricting the axes drops, not just apply the
change. Set the coloring to strand while you are there, so a block that runs
backwards is a different color rather than a bend in a black line:

<Figure caption="The alignment as a dotplot, both axes cut to the six chromosome arms. One forward diagonal in red, and a short reverse segment in blue where chr2R begins." src="/img/agent_synteny/dotplot_arms.png" />

## Ask where they disagree

```text
Where do the two genomes run in opposite directions? Answer from the
alignment file, not from the dotplot, and show me the numbers.
```

The last clause matters because a dotplot shows that two genomes are mostly
colinear, but a reverse-strand block a few hundred kilobases wide is a few
pixels at whole-genome zoom, and an agent asked to describe a picture will
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

```text
2L   22.15 Mb aligned,  0.28% reverse
2R   20.56 Mb aligned,  5.02% reverse
3L   22.56 Mb aligned,  0.03% reverse
3R   27.03 Mb aligned,  0.01% reverse
4     1.10 Mb aligned,  0.00% reverse
X    21.04 Mb aligned,  4.44% reverse
```

Four arms carry essentially no reverse-strand alignment, as expected of two
genomes assembled in the same orientation. Those four are the control for the
other two: 2R and X sit more than an order of magnitude above them.

Grouping the reverse-strand blocks of 5 kb or more, and cutting a group wherever
half a megabase passes with none, gives three regions:

```text
2R  sim    59,995 - 2,256,808  <->  mau   628,956 - 3,646,198   (2.20 Mb, 75 blocks)
X   sim 8,303,553 - 8,752,357  <->  mau 8,530,265 - 8,980,862   (0.45 Mb,  2 blocks)
X   sim 21,441,285 - 22,026,996 <->  mau 21,459,277 - 22,872,816 (0.59 Mb, 12 blocks)
```

The 2R region is the largest and the least tidy: 2.2 Mb at the centromere-
proximal end of the arm, in 75 short blocks because the sequence there is
repeat-rich. The two X regions are smaller and cleaner.

Ask which grouping it used. "The largest inversion" depends on how far apart two
blocks can be and still count as one region: at the half megabase above, 2R wins
on size and block count, and grouped more tightly 2R splits into clusters whose
largest is smaller than the X regions. Both answers are the same data.

## Ask to be taken there

```text
Take the synteny view to the 2R region, with the gene tracks on.
```

The two rows navigate separately, to `chr2R:1-2,400,000` on simulans over
`chr2R:500,000-3,800,000` on mauritiana. The ribbons cross in the middle of the
band, and the genes on the two rows run in opposite directions through it.

<Figure caption="The 2R region on both rows with the gene tracks on. Reverse-strand blocks in blue cross the band, short and many, because the sequence at this end of the arm is repeat-rich." src="/img/agent_synteny/inversion_2r.png" />

Then take it to the first of the two X regions, `chrX:8,100,000-8,950,000` over
`chrX:8,330,000-9,180,000`, which is where the same event reads cleanly:

<Figure caption="The X region at the same settings. Two reverse blocks cross in the middle of the band, with forward alignment in red on both sides of them." src="/img/agent_synteny/inversion_x.png" />

## What you had to tell it

Three sentences, and each prevents a failure with no error message:

- **Start long work in the background, and let it finish before opening
  anything.** Otherwise a tool call times out over an aligner that is fine, and
  the agent reports a failure that did not happen.
- **Restrict the dotplot axes to the arms.** Otherwise a few hundred unplaced
  scaffolds interleave both axes.
- **Answer from the file, not the picture.** Otherwise you get a description of
  a dotplot, which cannot resolve the thing you asked about.

Two more come up because the agent runs into them unprompted. Ask it to
screenshot and read the image back after anything it builds: a wrong track id,
an empty region and a dropped setting all render as a plausible browser with
something missing. And ask it to say the numbers before it navigates, so what
you are looking at is a claim you can check.

## The same pipeline as a script

For a reader who wants the files:

```bash
curl -O https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_fly_agent_synteny.sh
bash build_fly_agent_synteny.sh fly_agent_synteny_build
```

The script downloads both genomes, runs the alignment, indexes it, and writes
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
