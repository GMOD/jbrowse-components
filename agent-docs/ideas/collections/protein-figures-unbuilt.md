---
name: protein-figures-unbuilt
description: "Protein-browser figures the data supports and nobody has built: genome evidence driving the structure (constraint on an interface, KRAS tumor reads, a long read phasing two variants, a skip removing a folded domain), the painted fold as a supporting layer, and VHL, SOD1, DCLRE1C, PTPN11, PTEN. Read before proposing one."
---

# Protein figures not yet built

What the built ones are and the rules they follow (the variant's consequence
on screen, the linear view critical, a painted fold keyed as "effect of
changing each residue"):
[reference/PROTEIN_FIGURES.md](../../reference/PROTEIN_FIGURES.md).

- **Genome evidence that drives the structure**, as CCR5 Δ32 and MET exon 14
  do:
  - a population-constraint track whose depleted stretch lands on an
    interface;
  - tumor reads at KRAS codon 12;
  - a long read phasing two variants in trans;
  - a skip that removes a folded domain from the gene's own structure, which
    would read stronger than MET's 8-residue peptide on another protein. It
    wants Protein3d to "hide the highlighted residues", a structure filter
    from the genome view's highlight; `residueFilter.ts` ANDs its predicates,
    so a gap inside a chain needs an exclude predicate first.
- **The painted fold as a supporting layer**: a variant pair whose wild type
  is painted by the scan says both what the residue does and that the whole
  map agrees, if the key says what the color means.
- **The blinded ideator's concepts**: two exons holding one zinc atom (TP53
  C176 and H179 from exon 5, C238 and C242 from exon 7, two regions with a gap
  marker and dashed distances to the zinc), and an AlphaGenome splice
  prediction against Funk's validated exonic splice SNVs (codons 199 and 137)
  with the skipped exon colored on the fold.
- **Figures the data supports**: VHL hydroxyproline pocket (1LM8 with VH032
  4W9H, the SGE S111/H115 allelic series), SOD1 H81R, DCLRE1C H35D, PTPN11,
  PTEN.
- **Occlusion** is subtle in software GL at figure size; a headed capture
  decides whether `occlusion: true` stays on.
