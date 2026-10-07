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

An AI agent, given four requests in plain words, aligns two fruit fly species
that have no published alignment and inspects the result in JBrowse Desktop.
Typed one at a time, the requests ask the agent to:

- align the two genomes with minimap2 and open them side by side, genes and all
- add a dotplot of the pair, restricted to the six chromosome arms
- count alignment blocks by strand, to find where the two genomes run in
  opposite directions
- navigate the view to what it found

## Prerequisites

- JBrowse Desktop, installed and running (see the
  [desktop quickstart](/docs/quickstart_desktop))
- an MCP client with a shell of its own, for the alignment step: Claude Code, or
  Claude Desktop, set up as in [](/docs/agents)
- [minimap2](https://github.com/lh3/minimap2)
- `node`, for the [JBrowse CLI](/docs/cli)

## Where the data comes from

The assemblies are two GenArk genomes
([_D. simulans_](https://genomes.jbrowse.org/accession/GCF_016746395.2/),
[_D. mauritiana_](https://genomes.jbrowse.org/accession/GCF_004382145.1/)); each
hub config holds the 2bit sequence, a chromAlias file, an NCBI RefSeq gene track
and a Trix text index.

<details>
<summary>The files involved (no download needed)</summary>

- _D. simulans_ sequence, which the agent downloads to align:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/016/746/395/GCF_016746395.2/GCF_016746395.2.fa.gz
- _D. mauritiana_ sequence, which the agent downloads to align:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/004/382/145/GCF_004382145.1/GCF_004382145.1.fa.gz

</details>

## Ask the agent to align and open the two genomes

The first request, in one sentence:

```text
Align D. simulans GCF_016746395.2 against D. mauritiana GCF_004382145.1 with
minimap2. Run it in the background and poll it, and when it is done index it
and open both genomes side by side, with their gene tracks and the alignment
between them.
```

The agent runs this aligner command:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
## The largest chromosome measures 2.4% divergence (de:f), past asm10's 1%.
## --cs writes the difference string the index below carries.
minimap2 -t 8 -cx asm20 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
```

The whole-genome alignment takes several minutes, longer than the two-minute
timeout on `run_javascript`, so the request above runs it in the background.

Indexing the PAF lets the browser read one region of it without parsing the
whole file:

<!-- from: scripts/build_fly_agent_synteny.sh -->

```bash
jbrowse make-pif sim_vs_mau.paf
```

The config the agent writes merges the two genomes.jbrowse.org configs listed
above, keeping each gene track and adding the alignment as a synteny track.

Check the order of `assemblyNames` on the track the agent wrote. For your own
pair, swap `uri` for your `.pif.gz`, which needs its `.tbi` beside it, and load
both assemblies:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "sim_vs_mau",
  "name": "D. simulans vs D. mauritiana",
  "assemblyNames": ["GCF_016746395.2", "GCF_004382145.1"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "sim_vs_mau.pif.gz",
    "assemblyNames": ["GCF_016746395.2", "GCF_004382145.1"]
  }
}
```

In `assemblyNames`, the query (`sim.fa.gz`, the second `minimap2` argument)
comes first and the target second, the order of the PAF columns. In the other
order no chromosome name resolves and the synteny band draws empty.

<Figure caption="chr3R on both genomes with NCBI RefSeq genes on each row and the minimap2 alignment between them, colored red where the two run in the same direction. One block spans the window, and each gene meets its counterpart exon for exon." src="/img/agent_synteny/comparison_built.png" />

## Ask for a dotplot restricted to the chromosome arms

```text
Add a dotplot of the same two assemblies underneath.
```

Each genome has a few hundred unplaced scaffolds (not assigned to a chromosome),
which interleave the axes if drawn. Naming the arms gives one diagonal:

```text
Restrict both dotplot axes to chr2L, chr2R, chr3L, chr3R, chr4 and chrX.
```

Ask the agent to quantify what restricting the axes drops. Add one more request,
to color the dotplot by strand, so a reversed block draws in blue and a forward
one in red.

<Figure caption="The alignment as a dotplot, both axes cut to the six chromosome arms. One forward diagonal in red, with short reverse segments in blue where chr2R begins and partway along chrX." src="/img/agent_synteny/dotplot_arms.png" />

## Ask where the two genomes run in opposite directions

```text
Where do the two genomes run in opposite directions? Answer from the
alignment file, not from the dotplot, and show me the numbers.
```

A reverse-strand block a few hundred kilobases wide is a few pixels at
whole-genome zoom. The same information is in the PAF as numbers: aligned bases
per arm, split by strand, at mapping quality (MAPQ) 30 or better:

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

Four arms have essentially no reverse-strand alignment, and they are the
control: 2R and X sit an order of magnitude above them.

Grouping the reverse-strand blocks of 5 kb or more, and cutting a group wherever
half a megabase passes with none, gives three regions:

```text
2R  sim    59,995 - 2,256,808  <->  mau   628,956 - 3,646,198   (2.20 Mb, 75 blocks)
X   sim 8,303,553 - 8,752,357  <->  mau 8,530,265 - 8,980,862   (0.45 Mb,  2 blocks)
X   sim 21,441,285 - 22,026,996 <->  mau 21,459,277 - 22,872,816 (0.59 Mb, 12 blocks)
```

The 2R region is the largest and the least tidy; the two X regions are smaller
and cleaner.

## Ask the agent to open the 2R and X regions

```text
Close the gene tracks and take the synteny view to the 2R region.
```

The agent closes both gene tracks, so the view draws the whole-genome alignment
alone, and opens the simulans row at `chr2R:1-2,400,000` and the mauritiana row
at `chr2R:500,000-3,800,000`.

<Figure caption="The 2R region, the alignment alone between the two rows. Reverse-strand blocks in blue cross the band, short and many, because the sequence at this end of the arm is repeat-rich." src="/img/agent_synteny/inversion_2r.png" />

Then ask for the first of the two X regions, `chrX:8,100,000-8,950,000` over
`chrX:8,330,000-9,180,000`, where the reverse blocks are fewer and longer:

<Figure caption="The X region, the alignment alone between the two rows. Two reverse blocks cross in the middle of the band, with forward alignment in red on both sides of them." src="/img/agent_synteny/inversion_x.png" />

## Three instructions to include when prompting the agent

Three instructions each prevent a failure that raises no error:

- **Start long work in the background, and let it finish before opening
  anything.** Otherwise a tool call times out and the agent reports a failure
  that did not happen.
- **Restrict the dotplot axes to the arms.** Otherwise a few hundred unplaced
  scaffolds interleave both axes.
- **Answer counted from the alignment file.** Otherwise the agent describes the
  dotplot.

Two more are worth asking for:

- **Screenshot what you build and read the image back.** A wrong track id or an
  empty region still renders as a plausible browser.
- **Say the numbers before navigating.** What you then see is a claim you can
  check.

## Running the whole pipeline as a script

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

## Citations

- Chakraborty M, et al. Evolution of genome structure in the _Drosophila
  simulans_ species complex. _Genome Research_ 31:380-396 (2021).
  https://doi.org/10.1101/gr.263442.120
- Li H. Minimap2: pairwise alignment for nucleotide sequences. _Bioinformatics_
  34:3094-3100 (2018). https://doi.org/10.1093/bioinformatics/bty191
