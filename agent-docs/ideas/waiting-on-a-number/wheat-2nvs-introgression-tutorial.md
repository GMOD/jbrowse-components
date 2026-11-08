---
name: wheat-2nvs-introgression-tutorial
description: A tutorial reproducing Walkowiak 2020's percent-identity track for the Ae. ventricosa 2NvS segment on wheat 2A; the build script is on main, and it waits on a minimap2-versus-nucmer identity comparison that justifies the aligner.
---

# Wheat 2NvS introgression tutorial

- **Goal:** reproduce Walkowiak et al. 2020 (Nature) Fig. 2 track iii, percent
  identity to Chinese Spring: the ~33 Mb Ae. ventricosa 2NvS segment at the
  start of 2A in Jagger, Mace, SY Mattis and CDC Stanley, with the other 10+
  Genome cultivars as controls.
- **Built so far:** `scripts/build_wheat_introgressions.sh` (minimap2 asm20). No
  page, figures or demo upload. Add its `TUTORIAL_ORDER` slot with the page,
  since `check-guide-order` fails a slug with no page.

## Why it is parked

The aligner is not justified yet. Run minimap2 on the same 10 Mb query pieces
nucmer ran on, and compare the two identity profiles before choosing. nucmer's
case today is only that the paper used it, plus unique-match anchoring in an
85%-repeat genome. The build stays a reproducible script on the real data, with
no sampled or interim route.

## What failed

- minimap2 asm20 `-c` on whole 800 Mb chromosomes ran out of memory at ~100 GB.
- Unsplit nucmer runs one thread per query sequence, hence the 10 Mb pieces.

## Data

- GrainGenes' JBrowse 2 (`avena.pw.usda.gov/GG3pangenome/wheat/jb/jbrowseABD/`,
  40 assemblies) serves range requests but no CORS, so JBrowse Web cannot read
  it; the demo needs its own hosting. Its config's spelt GFF URL is wrong: the
  file is `T_spelta.sorted.gff3.gz`.
- Per-cultivar 2A gene tracks need CSI indexes, since wheat chromosomes exceed
  `.tbi`'s 512 Mb.
- ada's `/mnt/sdb/cdiesh/wheat_introgressions/build/` holds chr2A of all 11
  assemblies and per-cultivar 2A genes; `chunktest/Mace.delta` is the nucmer run
  on 10 Mb pieces. There, `PATH=$HOME/.local/bin` provides samtools 1.23, nucmer
  4.0.1, and k8 with paftools.js.
