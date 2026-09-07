---
name: a-per-alignment-id-tag-on-every-row-of-one
description: A per-alignment id tag on every row of one PAF alignment, so a synteny selection survives a PIF tier switch
area: comparative-and-pangenome
---

# A per-alignment id tag on every row of one PAF alignment, so a synteny selection survives a PIF tier switch

declined 2026-09-02, closing
`handoffs/pif-coarse-tier-rollout.md`. Feature ids are file offsets, so the
fine row and its coarse row have different ids and a click made on one tier
is cleared by crossing the threshold. The fix is a format change to a frozen
format (ADR-104) for a selection that already re-resolves on the next click;
nobody has asked for it.
