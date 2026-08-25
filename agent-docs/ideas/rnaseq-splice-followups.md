---
name: rnaseq-splice-followups
description: Five things the RNA-seq splice thread deliberately did not build after shipping the spliced-reads filter, spliced-first layout and splice-motif classification — a splice-chain group-by, differential transcript usage, downsampling, sashimi labels as a fraction, and a strandedness auto-detect chip. The thread left each as a one-line deferral; this file adds what each would need first. None is committed.
audience: internal
---

# RNA-seq splice: what the thread left unbuilt

The splice thread shipped the spliced-reads filter, spliced-first layout,
splice-motif classification with `hideNonCanonicalJunctions`, and the tutorial
section on junction files as BED arcs (`c39ae756e7`, `7065b2132e`, `6199ddb914`,
`aba8995204`, `bc04116182`). It deferred the five below as one-liners and
recorded no reasoning for any of them, so **the deferral is what is established
here; the first move under each is reconstructed, not decided.**

**Splice-chain group-by** — group reads by the ordered set of junctions they
cross, so one row means one isoform's evidence. Closest to buildable of the
five: the layout half already exists (spliced-first ordering puts those reads
adjacent), and the key is the read's `N`-op list, which
`features/gap/extract.ts` already walks once per read. What is missing is a
user. A group-by nobody has asked for costs a settings row forever, so this
waits on a feature request rather than on any code.

**Differential transcript usage** — two ways in, and they are different
products. A table join reads per-transcript counts from a spreadsheet and
colours a transcript track from a column, which is the SV inspector's shape
applied to gene models. A numeric ramp skips the table and colours from a score
already on the feature. The join answers the real question and needs a whole
UI; the ramp is cheap and answers a narrower one. Picking between them is the
first move, and neither is started.

**Downsampling** — a deep RNA-seq lane over a highly expressed gene is a case
where the junctions are the signal and the read bodies are the volume, so
sampling by read would keep the junction picture at a fraction of the rows.
Note what makes it more than a perf knob: a sampled pileup is a picture whose
apparent depth is wrong, and nothing in the chrome currently says so. That is a
chrome question before it is a fetch one.

**Sashimi labels as a fraction, with a depth-proof floor** — a junction arc
carries its supporting read count today. A fraction of local depth is more
honest (40 reads across a junction means different things at 50x and 5000x) but
a ratio over a small denominator is noise, so it needs a floor below which the
count is shown instead. Choosing the floor is the work, and it is a visual call
as much as a numeric one.

**Strandedness auto-detect chip** — library strandedness decides whether
`First-of-pair` / `Second-of-pair` colouring means what the reader thinks, and
someone opening another lab's BAM usually does not know the protocol. Aligner
tags are the cheap half and are already read: `getEffectiveStrand` resolves
`XS`/`TS` and falls back to `ts` on the read's own strand. What is not
established is what to do when none of the three is present, which is when a
reader most needs the chip — that wants a comparison against annotated gene
strand, and a display cannot assume an annotation track is loaded.

**Mirrored ± coverage band — declined**, and recorded in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) with what a
re-proposal has to beat.

The thread's one unfinished build item is a figure, not a feature:
[todo/capture-a-figure-for-the-junction-bed-tutorial-section.md](../todo/capture-a-figure-for-the-junction-bed-tutorial-section.md).
