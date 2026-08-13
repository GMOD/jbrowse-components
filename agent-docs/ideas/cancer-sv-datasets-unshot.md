---
name: cancer-sv-datasets-unshot
description: Cancer SV datasets for figures, including the dead ends, recorded so nobody re-checks them.
---

# Cancer SV datasets not yet shot

Lifted from the `cancer_sv` build; the tool and the verified COLO829/K562 facts
are in [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md).

- **HCC1395 multi-caller copy number.** SEQC2 publishes CNV output from six
  callers plus SNP arrays on one tumour, all hg38, and PacBio Revio HiFi
  tumour/normal BAMs are public at
  `downloads.pacbcloud.com/public/revio/2023Q2/HCC1395/`. "Callers disagree,
  adjudicate them against the reads" is a distinct tutorial from the existing
  C-GIAB one.
- **COLO320-DM ecDNA.** The strongest remaining focal-amplification story (MYC on
  ecDNA, CN ~100). Blocked only by disk: the ONT data is raw fastq in
  `PRJNA1110283` (33-53 GB per run) and needs a genome-wide minimap2 run before
  anything is browsable.

Two datasets that are dead ends, so nobody re-checks them: **SK-BR-3** — every
file under `labshare.cshl.edu/shares/schatzlab/www-data/skbr3/` 404s, leaving
only raw PacBio CLR in SRA `PRJNA476239`, so the paper is design inspiration
only. **C-GIAB / HG008** has no RNA arm at all and cannot carry a fusion
tutorial. COLO829 has no matching RNA and K562 no usable hg38 WGS (ENCODE's is
hg19 and 337 GB), which is why the tutorial uses two cell lines.
