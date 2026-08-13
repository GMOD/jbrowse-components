---
name: methylation-plotting
description: Modifications-track line and matrix views ranked by return: HP-stratified aggregate lines for allele-specific methylation, a simple aggregate line as the ~2h fallback, and a per-read matrix that `colorBy: modifications` + `sortBy: HP` may already cover.
---

# Methylation plotting

Modifications track: methylation line/matrix view (issue
[#5510](https://github.com/GMOD/jbrowse-components/issues/5510)). The key value of
methylartist locus is distinguishing haplotypes — per-HP aggregate lines reveal
allele-specific methylation (ASM). Options by ROI:

- **A — HP-stratified aggregate lines (recommended start).** One line per haplotype in
  the coverage area; at each CpG, y = methylation proportion among reads with that HP
  tag (HP:i:1 / HP:i:2 / unphased). Add `haplotype` to `ModificationEntry` (read HP in
  `extractModifications`/`processFeatureAlignments.ts`), stratify
  `computeModificationCoverage` by haplotype, add `drawModCovLine` (Canvas2D) + a
  `PASS_MOD_COV_LINE` GPU pass (reuse modCoverage geometry as a strip). Future:
  kernel-smoothed lines over a bandwidth of nearby CpGs.
- **B — simple aggregate line, no haplotype (~2h).** Single line per mod type; the
  worker already produces `modCovPositions`/`modCovHeights`, only the renderer + shader
  are new. Good fallback for non-phased / bisulfite data.
- **C — per-read matrix with haplotype sort.** Rows=reads, cols=CpG sites,
  color=per-read probability, sorted HP1-above-HP2 then by methylation fingerprint. May
  already be achievable via `colorBy: modifications` + `sortBy: HP tag` — verify before
  building; if UX suffices, C needs only docs.
- **Sequence:** B first (~2h), then A (~1d), C last or never.
