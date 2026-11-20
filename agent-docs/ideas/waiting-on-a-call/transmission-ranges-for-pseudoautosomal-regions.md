---
name: transmission-ranges-for-pseudoautosomal-regions
description: A transmission entry covers a whole refName, so chrX's male rule also covers the PARs, where a son inherits from both parents; an entry's optional range would give them the autosomal rule. Read before changing the assembly's transmission slot.
---

# Transmission ranges for the pseudoautosomal regions

A `transmission` entry
([ADR-279](../../architecture-decision-records/adr-279-a-pedigree-feeds-a-per-site-mendelian-check-and-the-assembly-states-transmission.md))
holds for a whole refName. The hosted hg38 and hg19 assemblies write
`{ refName: 'chrX', sex: 'male', from: 'mother' }`, which also covers PAR1 and
PAR2, where a son carries one copy from each parent. A son `1/1` with father
`0/0` and mother `0/1` reads `consistent` there, though the father gave him
nothing he has. The user guide names this as under-flagging; a het son already
falls through to the autosomal rule, so the gap is the homozygous son.

An entry's optional `start` and `end`, or an `except` list of ranges, would let
the hosted entries hand the PARs the autosomal rule (GRCh38 chrX:10,001-2,781,479
and 155,701,383-156,030,895; GRCh37 chrX:60,001-2,699,520 and
154,931,044-155,260,560, the GRC's coordinates). The rule then depends on
position, not only refName:

- `transmissionArg` resolves one rule per region, so a region crossing a PAR
  boundary would send both rules and the bounds, and the worker would pick per
  feature start.
- `makeMendelianCheck` memoizes per rule array, so keeping one array inside the
  PAR and one outside keeps its memo at two entries a region.
- The slot's shape grows a range, which reaches every assembly config that
  states transmission, including the hosted ones.

The call: whether a homozygous son in the PARs (about 2.7 Mb of chrX) is worth a
position-dependent rule in the assembly slot, or stays a documented limit.
