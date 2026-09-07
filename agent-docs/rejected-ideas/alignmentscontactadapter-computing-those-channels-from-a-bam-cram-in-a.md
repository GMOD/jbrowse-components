---
name: alignmentscontactadapter-computing-those-channels-from-a-bam-cram-in-a
description: `AlignmentsContactAdapter`, computing those channels from a BAM/CRAM in a worker so a Hi-C track needs no precomputed `.hic`
area: data-and-demos
---

# `AlignmentsContactAdapter`, computing those channels from a BAM/CRAM in a worker so a Hi-C track needs no precomputed `.hic`

written, tested and
documented, then declined 2026-09-02 in favour of building the contact map
out-of-band as a `.hic`. Closes `handoffs/alignments-contact-adapter.md`.

It wraps an alignments adapter, bins the reads in view into the same four
channels (discordant pairs plus SA splits, the LL/RR inversion signature, the
RL eversion signature, and the bin-pair depth difference) and hands
`RenderHicData` a header it computes rather than reads. It works; the reason
it is not landing is that it moves the preprocess into the browser without
changing what the preprocess produces. The depth channel's four failures above
are properties of the cell, not of where it is computed, and the pair channels
— the half that works — are sparse enough that a juicer `pre` run is cheap and
gives a multi-resolution file the adapter cannot: an on-the-fly bin cannot sum
into a coarser one at zoom-out, so the live route re-walks the reads at every
resolution and re-derives a matrix the `.hic` would already hold.

The code is on the `worktree-agent-a28a25e713044ce59` branch, the adapter
itself in `22a3cbe97b` (~1200 lines with three test files) and the manifest,
doc-page and comment commits after it. Its tutorial section — `## Without the
preprocessing` in `sv_contact_maps.md`, the page this section's first entry
deleted — stays unwritten with it.
