---
name: hprc-genotypes-and-sample-count
description: The pgbi move and the sampleCount rename are landed, reshot and checked against their frames; the corpus-wide "carry" sweep and the claudish checklist push are left
audience: internal
kind: handoff
---

# HPRC genotypes and `sampleCount`: what is left

`pangenome_hprc` reads the graph against `pgbi.vcf.gz` with `alleleLength>=50`
and a 20 MB `fetchSizeLimit` (`reference/HPRC_RELEASE2.md` §"Which VCF to read
the graph against"). The graph plugin's `sampleCount`/`samples` rename is hosted
as 4.2.0, the graph figures are reshot against it, and the genomes portal's
variants launch reads `pgbi` too (jb2hubs `aad46f74715`).

## Open

- The corpus-wide "carry" sweep: about 600 uses in other hand-written docs
  (`website/docs` outside the pangenome pages). The claudish checklist names the
  pattern and its `scan.sh` labels it under `agency`.
- `~/src/claudish` has `edfa0d6` (the carry entry) on a main that was already
  five commits ahead of origin; nothing pushed.
