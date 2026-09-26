---
name: bench-tool-handoff
description: What JBrowse owes a molecular biologist between picking a locus and ordering oligos — a multi-tool tutorial as the deliverable, and the GenBank export gaps that block writing it.
---

# The handoff from a locus to a construct

Every bench workflow splits in two. Deciding **where** is a genomic-context
question: which transcript, which exon, is there a common variant under the
primer, is this a repeat, does this sequence occur elsewhere. Designing **the
molecule** is thermodynamics and enzymology: Tm, secondary structure,
restriction sites, homology arms.

JBrowse owns the first and has none of the second. Primer3, SnapGene and
Benchling own the second and are blind to the first. ADR-137 and ADR-140 already
draw that line for this repo — converters and views, not analysis — so primer
design, Tm and off-target scoring are out by standing decision, and moving a
region between the two halves is in.

The product is therefore the handoff, not a design tool.

## The deliverable is a tutorial, and the tutorial is also the test

One tutorial, the construct workflow, because every other bench task hangs off
it:

> a locus → JBrowse, to pick the transcript and see the repeats and common
> variants where the primers will sit → export the region **with flanks** as
> GenBank → SnapGene / Benchling / Primer3Plus, to design → **back to JBrowse
> for in-silico PCR** → order

Step five is what makes this a JBrowse tutorial rather than a SnapGene one.

**Write it against current `main` before building anything.** Every place the
draft has to say "and now do this awkward thing" is a gap found by walking the
workflow, which is a better build list than a survey of the code produces. The
gaps below came from the survey and should be re-derived that way.

Keep it to one tutorial. The corpus is crowded, and CRISPR is a section of this
one at most.

## What blocks writing it

`stringifyGBK` already exists and is the only path in the repo that exports
sequence and features together
(`packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/genbank.ts`,
reached from a track's **Save track data**). Four things stop it serving the
workflow above.

~~**The feature-key column takes JBrowse's type string raw.**~~ Fixed:
`insdcFeatureKey` maps the SO spellings this tree emits and sends everything
else to `misc_feature` with the original term in `/note`. Primer footprints are
`primer_bind` now, and `/gene` no longer gets threaded off any parent that
happened to have children — an hgPcr product went out as `/gene="100 bp"` and a
BLAT hit as `/gene="YourSeq 99.1%"`.

**The record still carries absolute coordinates in its attributes.** A CRISPR
guide's `cutSite` is a genomic position, dumped verbatim into a record whose own
coordinates start at 1. The exporter has no way to know which attributes are
coordinates, so this wants per-type knowledge it does not have.

**There is no region-with-flanks control.** A construct needs flanking sequence,
because that is where the primers go. The export takes the regions captured at
dialog mount.

**The export is per-track, and a construct is a locus.** Per-track-type
overrides replace the format list wholesale, so `VariantTrack` offers VCF only
and `ReferenceSequenceTrack` FASTA only — the dbSNP track under a primer cannot
reach the GenBank at all. What the workflow wants is one record carrying every
track on screen.

**Feature colour has a tool-specific spelling** — SnapGene stores it in a
`/note` qualifier and ApE in `/ApEinfo_fwdcolor`. Reported, not verified here;
check both against a real file before building either.

Out of scope until someone asks: a GenBank **reader**. None exists, so the round
trip is impossible today, but the tutorial's loop closes without one — step five
takes primer sequences, not a file. A reader answers a different question,
whether a construct someone already holds matches the genome.

## Which sequence tools finish the question they start

The test for keeping a tool is not whether it is useful. It is whether the
answer completes the user's question or hands them off mid-air.

| Tool | Finishes? |
| --- | --- |
| Sequence pattern search | Yes — you asked where a motif occurs |
| Get sequence, feature sequence | Yes |
| In-silico PCR | Yes, and rarely: two services in the world answer primer specificity now that e-PCR is retired, and this ships one of them |
| BLAT | Yes, inside its envelope |
| Motif list / restriction sites | Yes, but the question usually gets asked one step later, on the extracted construct |
| CRISPR guide mode | **No** |
| GenBank export | Not yet, and it is what every handoff runs through |

CRISPR guide mode is the one that ends in a cliff. Someone wanting a guide they
can order gets candidates with `gcPercent` and a polyT flag and no way to know
whether any of them cuts elsewhere; `CrisprGuideAdapter` says so in its own
comments twice. **The promise is what is oversized, not the code** — reframe the
mode as triage in view, scored in CRISPOR, and the fix is a doc rewrite rather
than a deletion.

## In-silico PCR has a parameter that does nothing

`ispcrQuery.ts` sends `wp_perfect: '15', wp_good: '15'`. In kent's
`gfPcrLib.c`, `goodSize = minGood - minPerfect`, which is zero at those values,
and the behaviour that follows is asymmetric:

- Both primers must match the genome exactly over their 3′-terminal 15 bases.
- The **forward** primer's remaining 5′ bases are examined over a window
  `minGood - minPerfect` wide — so at these values, not at all.
- The **reverse** primer's 5′ bases are examined over `rPrimerSize - minPerfect`
  bases whatever `minGood` says, scored two matches per mismatch. For a 20-mer
  that is a five-base tail where one mismatch passes and two fail.

Two things follow. Exposing `wp_good` on the dialog is what turns the forward
window on, and it is the knob that makes the tool's mismatch tolerance real.
And `website/docs/user_guides/blat.md` — "UCSC tolerates one toward a primer's
5′ end" — describes the reverse primer and understates the forward one, which at
these values tolerates any number because it never looks.

## Declined, with the reason

**Primer design, Tm, off-target scoring** — analysis, so ADR-137 and ADR-140
already refuse them.

**Re-implementing CRISPOR** — it is free, web-hosted, and already annotates each
off-target as exon, intron or intergenic. The narrow gap left is seeing
off-targets against *your* tracks rather than its gene set, and its downloads
are Excel and TSV rather than BED, so even that needs a conversion. Not worth
building before someone asks.

**An NCBI BLAST client** — Primer-BLAST has no API at all, and a measured ~1 kb
megablast against GRCh38 through the public URL API ran 32 minutes without
completing against NCBI's own 22-second estimate. A link-out that prefills the
search page costs a URL and is honest about what BLAST answers. Note the premise
to avoid: "BLAST hits have nowhere to go in a genome view" is wrong — SGD,
FlyBase via the Alliance, and Ensembl all wire per-species BLAST into their own
browsers. What they built is BLAST scoped to one assembly, which is
[local-sequence-search.md](local-sequence-search.md)'s shape.

## Demand

The only tally in this repo puts sequence tools at one discussion and zero
issues, with its own caveat that this reads as no baseline rather than no
interest. That is thin ground for a build and ample ground for a tutorial, which
is the cheap way to find out which it is.
