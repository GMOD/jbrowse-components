# Take: rebuild the derivative allele

A somatic structural variant callset, a tumor's long reads streaming from S3,
and a rearrangement that joins three chromosomes inside a kilobase. The agent
finds the chain in the VCF, pulls the reads that cross all three loci, builds
the derivative contig from them, aligns it back, and then shows the reads on the
allele it built, where none of them clips. Every step exists in
`scripts/sv_multihop.py` and is documented in
`agent-docs/reference/SV_MULTIHOP.md`; the demo is an agent writing the short
form of that live, with the tree's version as the answer key.

```
node scripts/agent-demos/agentDemo.mjs out/derivative scripts/agent-demos/takes/derivative.mjs
```

Shoot this one last. It is the longest, and its payoff depends on the other two
having taught the viewer what a synteny view is.

## The data

COLO829, ONT R10, from the ONT open data bucket:

```
https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829.wf-somatic-sv.vcf.gz
https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
```

The VCF is 260 KB. The CRAM stays remote; only three windows of it are read.

## Before filming

The plan as first written needed the 3 GB GRCh38 FASTA on disk to decode the
CRAM. It does not. The CRAM's `@SQ` lines carry MD5s, but htslib's EBI fallback
returned nothing from this machine, and a full download is a poor first minute
of a clip anyway. What works, in about 40 s total, is a three-chromosome
reference pulled by remote `faidx` from the hosted GRCh38, whose sequence names
are unprefixed:

```bash
mkdir -p out/derivative/cwd && cd out/derivative/cwd
WF=https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup
curl -sL -o COLO829.somatic-sv.vcf.gz $WF/COLO829.wf-somatic-sv.vcf.gz
curl -sL -o COLO829.somatic-sv.vcf.gz.tbi $WF/COLO829.wf-somatic-sv.vcf.gz.tbi
samtools faidx https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz 3 10 12 |
  sed 's/^>\([0-9XY]*\)$/>chr\1/' > grch38_chr3_10_12.fa
samtools faidx grch38_chr3_10_12.fa
```

Measured: 30 s for the three chromosomes (465 Mb), then a `samtools view -T` of
the three loci windows against it streams 467 alignments from the CRAM in 7 s.
The tree's `derive` run end to end against this file, slice to consensus to
back-alignment to realigned reads to config, took 6 s and reproduced the four
segments below exactly, so the whole allele is under a minute on camera. The
system prompt in `derivative.mjs` names these two files and the CRAM URL, so the
agent starts from the callset rather than from a download.

`samtools consensus` needs 1.16 or later; this machine has 1.24.

## What a good take does

**Turn one** is the chain search. Junction endpoints from the BND brackets and
the symbolic `END`s, reciprocal pairs collapsed, endpoints on one chromosome
within a read length of each other linked. The tree's version answers in 0.7 s:

```
100 distinct junctions
4 chains of >=3 junctions linked by reference segments <=20000 bp

chain 1: 3 junctions across 3 chromosome(s)
    chr3:25,359,111 <-> chr12:72,273,112
    chr3:25,359,568 <-> chr10:58,717,464
    chr10:58,717,662 <-> chr12:72,273,294
```

Three of the four chains are on one chromosome; the one that crosses three is
this, RARB on chr3, BICC1 on chr10, TRHDE on chr12. The agent's own script will
differ in how it dedups a reciprocal pair (the tree uses a 10 bp tolerance, and
`SV_MULTIHOP.md` explains why that number is not the segment threshold) but has
to land on the same three junctions. Showing them is a `BreakpointSplitView` on
hg38 with the VCF track, or the VCF's features listed.

**Turn two** is the reconstruction. Reads at the three windows, the ones whose
alignments (primary plus `SA` tag) touch all three chromosomes, the longest as
backbone, the rest polished onto it with `minimap2 -ax map-ont` and
`samtools consensus`, and the trimmed consensus aligned back with `-c --cs`
against the reference windows, not the whole reference (repeats shared between
windows tie at MAPQ 0 otherwise; the tree's script has the comment). Measured
here, on the slice above:

```
29 reads whose alignments touch chr3, chr10 and chr12
longest read in the slice 78,982 bp
```

and the shape the reconstruction has to reproduce, from `SV_MULTIHOP.md`, where
it has been derived three independent ways:

```
derivative      0-32,732  +  chr3   25,326,821-25,359,568
derivative 32,732-32,931  +  chr10  58,717,463-58,717,662
derivative 32,932-33,115  -  chr12  72,273,111-72,273,294
derivative 33,126-39,549  -  chr3   25,352,683-25,359,111
```

Two chr3 arms folded back on each other with 199 bp of chr10 and 183 bp of chr12
spliced in at the turn. An agent that reports a three-segment allele has lost
the chr12 insert; that is the known dissenting route at 2 reads against 28, and
the tree records it.

**Turn three** needs a config with the derivative as an assembly. The
three-chromosome FASTA is the reference assembly, the consensus FASTA is the
second, the back-alignment PAF is a `SyntenyTrack` between them, and the reads
realigned to the derivative are an alignments track on it:

```bash
jbrowse add-assembly grch38_chr3_10_12.fa --name hg38 --load inPlace --out config.json
jbrowse add-assembly der3.fa --name der3 --load inPlace --out config.json
jbrowse add-track der3_vs_hg38.paf --assemblyNames der3,hg38 --load inPlace --out config.json
jbrowse add-track reads_on_der3.bam --assemblyNames der3 --load inPlace --out config.json
```

then `open` on that config and a `LinearSyntenyView` with `der3` on top showing
the whole contig and hg38 below at `chr3:25,320,000-25,365,000`, ribbons colored
by strand so the folded-back arm reads as the crossing it is. The
`--jbrowse-out` flag of the tree's `derive` writes exactly this config and is
the answer key for the reviewer, not the route the agent should take on camera.

**Turn four** is a count, not a picture. On the realigned BAM, over each of the
four junction coordinates on the derivative, the number of reads whose CIGAR
clips within a few bases of the junction:

```
0 of the 29 primary alignments clip at any of the four junctions
depth 28 across all of them
```

The agent gets there with `samtools view` and a CIGAR check in the shell, or
with `jb.getFeatures` on the alignments track and each feature's `CIGAR`, and
then shows the pileup at one junction with the read connections on. The control
is the same reads on hg38: at `chr3:25,359,568` on the reference every spanning
read clips, because the reference has no chr10 to continue into. A
`BreakpointSplitView` of chr3 and chr10 with the tumor CRAM shows that side.

## Verified before this was written

| Claim                                    | How                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| The chain search is instant              | `sv_multihop.py chains --min-hops 3`, 0.7 s, chain 1 as listed             |
| No 3 GB reference is needed              | remote `faidx` of chr3, chr10, chr12 in 30 s; CRAM slice decodes on it     |
| The EBI MD5 fallback does not replace it | `REF_PATH` to ebi.ac.uk decoded 0 reads and cached nothing                 |
| 29 spanning reads are in the slice       | `SA` tags touching all three chromosomes, matching `SV_MULTIHOP.md`        |
| `samtools consensus` exists here         | samtools 1.24                                                              |
| The config opens in Desktop              | `open` on the `--jbrowse-out` config plus the synteny spec above, over MCP |

## Rehearsal, 2026-09-01

Shot once through the harness. `derivative-take1-transcript.txt` beside this
file is the record; the clip and poster are
`website/static/media/mcp/agent_derivative_take1.*` (79 s after `encode.mjs`).

| Turn                      | Wall  | Outcome                                                                                                                                              |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| chains across three chr   | 310 s | junction graph over the 68 BND rows, one three-chromosome component, shown as a three-locus view with read arcs                                      |
| rebuild the allele        | 357 s | 29 spanning reads, 57,134 bp backbone, three consensus rounds converged, 39,549 bp contig; the four segments match the table above to the base       |
| reads on both coordinates | 233 s | synteny view, derivative over the three reference windows, tumor reads on both rows, soft clips shown                                                |
| prove no read clips       | 155 s | 0 of 31 crossing alignments clip at any junction; the 131, 61 and 44 that do clip are normal-allele reads whose tails map to the next reference base |

The agent realigned all 326 locus reads to the contig rather than only the 29
spanning ones, so the normal allele is on the derivative track too and clips at
every junction. It caught that, audited the CIGARs, mapped the clipped tails
back to the reference, and answered the turn as "no read that crosses a junction
clips at it", which is the stronger claim. The tree's 0 of 29 is the spanning
subset of the same count. That correction is the best moment of the three takes
and the turn should stay worded as it is.

## Open

- Nothing blocking. The known dissenting three-segment route did not appear.
- `jbrowse add-track` on a PAF infers `PAFAdapter`; that adapter loads the whole
  file, which is fine at 40 kb of contig and would not be for a genome.
