---
name: shoot-the-multihop-chain-as-counted-arcs-in-one-lgv
description: take the partner windows from the nanomonsv VCF, not the picture
metadata:
  area: figures, alignments
  category: ready
---

# Shoot the multihop chain as counted arcs in one LGV

`multihop_split_view` tells this story today as four panels built by "Reconstruct
derivative allele → draw as split", plus a script. The read-connection arcs give
a second, much shorter route to it: COLO829's `chr3:25,357,600-25,361,000` with
the chr12 and chr10 partner windows as further **displayed regions** of one LGV,
tumour track at `readConnections: 'arc'`, and each hop draws as one coalesced,
support-weighted arc across the region dividers. This belongs beside the existing
figure rather than replacing it — the reconstruction is the story there, and this
is what the raw evidence for it looks like.

ONT split junctions are exact, so they coalesce on `arcKey` with no jitter and
each arc's width is the support nanomonsv called on. That is the best case this
feature has, which is why it is worth shooting.

**The figure only works if the partner windows are right**, and they come from
the nanomonsv VCF / `sv_multihop.py derive` output rather than from reading the
picture — [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) has the chain and
what is established about it.
