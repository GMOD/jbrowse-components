---
title: Read-pair heatmaps
description:
  Turn an ordinary paired-end WGS alignment into a Hi-C-style contact heatmap
  that reveals structural variants, and load it in JBrowse as a .hic track
guide_category: Tutorials
tutorial_category: Structural variation
---

A paired-end alignment already carries a rich structural-variant signal: pairs
whose two ends land far apart, in the wrong orientation, or on different
chromosomes mark rearrangement breakpoints. PopicLab's
[Cue](https://github.com/PopicLab/cue)
([Popic et al. 2023](https://www.nature.com/articles/s41592-023-01799-x)) makes
that signal legible by rendering each pair of genome intervals as a 2D image and
letting a neural network read the patterns. That 2D view of paired reads is
exactly what a Hi-C contact matrix stores, and JBrowse already renders `.hic`
files as a heatmap. So we can bin read pairs into a `.hic` file and get a
Cue-style read-pair heatmap directly in JBrowse, no model required, with each
structural variant appearing as an off-diagonal spot linking its two
breakpoints.

This tutorial builds two such heatmaps from the HG008-T
[C-GIAB](/docs/tutorials/sv_visualization_cgiab) pancreatic-cancer tumor
Illumina WGS. Questions of any kind are welcome on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions).

## From read pairs to a contact matrix

The whole pipeline is `samtools` → a one-line-per-pair contact list →
`juicer_tools pre` → a `.hic` file. First slice the region you care about from
the (possibly remote) BAM and derive its chromosome sizes:

```bash
BAM=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/NYGC_Illumina-WGS_20231023/HG008-T_Illumina_161x_GRCh38-GIABv3.bam
samtools view -b "$BAM" chr3:182,000,000-185,000,000 -o chr3q.bam
samtools index chr3q.bam
samtools view -H "$BAM" | awk -F'\t' '/^@SQ/{for(i=1;i<=NF;i++){if($i~/^SN:/)n=substr($i,4);if($i~/^LN:/)l=substr($i,4)}print n"\t"l}' > chrom.sizes
```

Then emit one contact per read pair. Each pair becomes a Juicer "short format"
line joining the two ends. `.hic` bins by fixed resolution, so the
restriction-fragment columns are dummies:

```bash
# str1 chr1 pos1 frag1 str2 chr2 pos2 frag2: sorted the way juicer_tools wants
samtools view -q 20 -f 65 -F 2316 chr3q.bam \
  | awk '{
      str1=and($2,16)?1:0; str2=and($2,32)?1:0
      c2=($7=="=")?$3:$7
      print str1, $3, $4, 0, str2, c2, $8, 1
    }' \
  | sort -k2,2d -k6,6d -k3,3n -k7,7n > chr3q.contacts.txt
```

`-f 65` keeps one record per pair (paired, first-in-pair) and `-F 2316` drops
unmapped, mate-unmapped, secondary, and supplementary reads. This keeps _every_
pair, which produces the Hi-C-like insert-size diagonal plus off-diagonal SV
signal. Cue instead emphasizes the discordant channels, and it helps here too:
keeping only pairs with an abnormal insert size, wrong orientation, or a mate on
another chromosome drops the diagonal and leaves the breakpoint signal alone.
The repo ships
[`bam2contacts.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bam2contacts.sh),
which does all of the above, orders chromosomes by their `.hic` index (so
inter-chromosomal pairs sort correctly), and takes an `all` or `discordant`
mode. Finally, write the `.hic` and add it to JBrowse:

```bash
bam2contacts.sh chr3q.bam discordant chrom.sizes > chr3q.contacts.txt
java -jar juicer_tools.jar pre -r 1000,2500,5000,10000,25000 \
  chr3q.contacts.txt HG008-T_readpair_chr3q.hic chrom.sizes
jbrowse add-track HG008-T_readpair_chr3q.hic --out /path/to/jbrowse2
```

These are raw read-pair counts, not a balanced Hi-C experiment, so in the
track's display settings set the normalization to **NONE**. Log-scale color with
the percentile saturation off then sets the color by the strongest cluster, so
breakpoint spots read dark while the scattered background fades toward white.

## Reading the signatures

The figures below are discordant-pair maps of the HG008-T tumor. The shaded
columns mark benchmark breakpoints. Each SV sits where a pair of those columns
crosses.

<Figure caption="A read-pair heatmap over a 3 Mb chr3q window. The off-diagonal dot where the two left shaded columns meet is the junction of a 1.4 Mb tandem duplication (benchmark SV_22, 182.47-183.89 Mb): its spanning pairs join the duplication's far end back to its start. Distance from the diagonal is the duplication length." src="/img/readpair_heatmap_chr3q.png" />

A tandem duplication produces pairs that span its junction in an outward-facing
orientation, joining the duplication's end back to its start, so it reads as a
single off-diagonal spot. A deletion looks similar but closer to the diagonal.
An inversion flips pair orientation, and a translocation lands the two ends on
different chromosomes.

<Figure caption="The chr3↔chr13 translocation (benchmark SV_20, chr3:139,976,414 to chr13:114,353,244), the same junction the C-GIAB tutorial drills into with a breakpoint split view. A two-region view (chr3 window left, chr13 window right) renders the inter-chromosomal block of the matrix, and the read pairs spanning the fusion pile up into one bright spot linking the two chromosomes." src="/img/readpair_heatmap_translocation.png" />

## Toward multi-channel maps

A `.hic` matrix stores a single count per bin pair, so one heatmap can't tell a
deletion from an inversion the way Cue's multi-channel images can: Cue puts read
depth, pair orientation (same-strand LL/RR vs outward-facing RL), and split-read
support in separate channels. Two JBrowse-native ways recover that channel
sense:

**One `.hic` per orientation, loaded as separate tracks.** Split the discordant
pairs by the signature they carry and build a `.hic` from each. The strand of
each mate comes straight from the flag, so the filter is a one-line predicate on
the contact stream. For example, keep only same-strand pairs for the inversion
channel:

```bash
# same-strand (LL/RR) pairs → inversion channel
awk '(and($2,16)?1:0) == (and($2,32)?1:0)' chr3q.contacts.txt > chr3q.inv.txt
```

Do the same for outward-facing large-insert pairs (deletions / tandem
duplications) and inter-chromosomal pairs (translocations), `pre` each, and load
the tracks side by side, each with its own color ramp. Which track lights up at
a locus reads out the orientation channel.

**A BEDPE arc track, where color is the channel.** Emitting the discordant pairs
as BEDPE and rendering them with JBrowse's paired-arc display (`BedpeAdapter` +
`LinearPairedArcDisplay`) draws each pair as an arc, and a `jexl` color
expression on an orientation column paints inversions, deletions, and
duplications in different colors within a single track, the closest one-track
analogue to Cue's stacked channels.

## What this is and isn't

Because only discordant pairs contribute, the map is sparse: an isolated event
is one spot, not the dense fill of a true Hi-C experiment. Scanning a whole
chromosome this way turns each rearrangement into one such spot, so it is a
fast, caller-free way to see rearrangement structure at a glance. It complements
rather than replaces a dedicated SV caller.

## Reproduce it end to end

[`build_readpair_heatmap_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_readpair_heatmap_cgiab.sh)
slices the two regions from the remote 161x tumor BAM, builds both `.hic` files,
and wires up a runnable JBrowse:

```bash
bash scripts/build_readpair_heatmap_cgiab.sh   # builds ./readpair_heatmap_build/jbrowse2
npx --yes serve readpair_heatmap_build/jbrowse2
```

It only fetches the two small regions (under 1 GB), not the whole genome, and
pins the C-GIAB FTP path and benchmark regions so re-running reproduces the same
files. It needs `samtools`, `java` (for `juicer_tools`, fetched automatically if
absent), and node for the JBrowse CLI.

## See also

- [Hi-C track](/docs/user_guides/hic_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [Gallery: coverage, copy number, and epigenomics](/gallery/#copynumber)
