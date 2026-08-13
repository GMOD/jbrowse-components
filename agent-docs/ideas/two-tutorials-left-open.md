---
name: two-tutorials-left-open
description: The two tutorials the focus pass left open, including why `tutorials/rnaseq.md` needs a finding rather than a tour.
---

# Two tutorials the focus pass left open

The 2026-08 tutorial-focus pass refocused `synteny_visualization`,
`analyze_trio`, `methylation` and `scatac_pseudobulk` onto one dataset each and
built the three Dog10K pages
([reference/DOG10K_DATASETS.md](../reference/DOG10K_DATASETS.md)). Two are left:

- **`tutorials/rnaseq.md` needs a finding, not a tour.** End on something
  biologically interesting rather than "here is some stuff" — a new gene model,
  intron readthrough, or **differential isoform usage with transcript glyphs
  colored by a pipeline's call**. The last is strongest and mechanically ready: a
  GFF attribute plus `jexl:randomColor(get(feature,'<attr>'))` on the canvas
  display colors transcripts, exactly as the H. pylori ortholog figure does. What
  it needs is a two-condition long-read dataset and a small pipeline to write the
  attribute. Note the coloring jexl evaluates on the **drawn** feature (a CDS
  subfeature for a gene), which is why `name` gave protein accessions and `gene`
  was the right attribute — same trap as in `specs/synteny.ts`.
- **`tutorials/pangenome_hprc.md` carries both HPRC release 1 and release 2
  figures.** Splitting is optional and lowest priority, since the two releases
  are the same project.

Also parked from that pass: the **wolf-ancestry frequency sweep across all
autosomes**, which would let the local-ancestry tutorial quote genome-wide
fractions instead of chr1-only ones. Run `build_dog10k_wolfdog_ancestry.sh` over
chr1..chr38 and summarize wolf ancestry per position across the eight wolfdogs as
a quantitative track. Cost re-measured 2026-08-04 after the target set grew from
11 animals to 243: chr1 is ~15 minutes (4 of remote slicing for 591 samples, the
rest FLARE at 16 threads), and chr1 is ~6% of the autosomes, so the sweep is 4-5
hours rather than the ~3.5 the 11-animal run implied. Compelling if a depleted
region lands on something known — but with eight animals the noise is real:
describe it, do not call it selection.
