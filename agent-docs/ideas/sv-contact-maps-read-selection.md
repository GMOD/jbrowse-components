---
name: sv-contact-maps-read-selection
description: Which reads sv_contact_maps.py counts — an edge-spanning pair dropped by the read-1 dedup, no duplicate or QC-fail filter, and split reads that never reach the orientation channels. Each fix changes every published count and figure, which is why they are parked rather than done.
---

# sv_contact_maps: which reads the channels count

Three read-selection defects in `scripts/sv_contact_maps.py`, found reviewing
the SV contact-map pipeline. They are parked together because they share one
consequence: **each changes every number the channels produce**, so fixing them
invalidates the counts quoted in
[reference/DEMO_DATASETS.md](../reference/DEMO_DATASETS.md) and the four
published `sv_contact_maps` figures. The work is the re-capture, not the patch.

Taken together they are also the case for deciding the pipeline's read-selection
policy **once**, in one place, rather than three times.

## 1. The read-1 dedup drops pairs that straddle the slice edge

`pair_channels` returns nothing unless the record carries `READ1`
(`sv_contact_maps.py:94`), which dedups a pair to one contact. But
`samtools view <region>` returns records *overlapping* the region regardless of
where the mate sits, so for a pair with one end outside the fetched slice only
one record is present — and whether the contact is written is a coin flip on
which mate happened to carry `0x40`.

A junction at `7:70,555,000` whose other side sits outside the
`7:70,300,000-70,560,000` slice therefore draws at roughly half its true
support, non-deterministically. The module docstring's claim that
`discordant.hic` holds "every pair … >= --min-span apart" is false for every
edge-spanning pair. `pos <= pnext` is the position-based equivalent and is what
`contact()` already uses to order its ends.

## 2. No duplicate or QC-fail filter

The flag constants list `PAIRED, UNMAPPED, MATE_UNMAPPED, REVERSE,
MATE_REVERSE, READ1, SECONDARY, SUPPLEMENTARY` — no `0x400` and no `0x200`.
JBrowse's own default is `flagExclude: 1540` (`plugins/alignments/src/shared/util.ts`),
so `depth_difference.hic` and the alignments coverage band, drawn one above the
other over the same BAM in the same demo, count different read sets. The gap is
widest exactly where the demo points the reader: the chr17 flanks that
`DEMO_DATASETS.md` already calls "a full plaid" are where duplicate rate is
highest.

Whether to match JBrowse's default or to state the difference is the decision.
Matching it is the smaller surprise for a reader comparing the two tracks.

## 3. Split reads never reach the orientation channels

`split_contacts` computes both strands and then discards the classification,
writing only to `discordant` (`sv_contact_maps.py:106-131`, used at `:203`). So
a strand-flipped `SA` segment — the canonical inversion split signature — never
lands in `same_strand`. The docstring calls the orientation channels "the
subset", which is then untrue for splits.

It does not bite on the shipped data: these GIAB BAMs carry no `SA` tags, as
`DEMO_DATASETS.md` notes. The helper is offered as general in its `Usage:`
block, so either classify them or narrow the docstring.

## Also parked, unrelated to counts

`na12878_sv_channels` sets `colorBy: { type: 'pairOrientation' }`, which draws
nothing: with the pileup hidden there are no read fills to paint, and the arcs
take `arcColorByType` (`svChannelsPreset.ts:36` states this outright). The slot
is inert and `pairOrientation` is `mateAware`, so it costs a mate-aware fetch
for no visible effect. Removing it changes no pixel; the prose that claimed the
preset writes it was corrected in `d4717f4d12`.
