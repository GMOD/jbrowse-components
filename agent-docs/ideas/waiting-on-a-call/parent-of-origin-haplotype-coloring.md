---
name: parent-of-origin-haplotype-coloring
description: Coloring haplotype cells by the parent whose allele they match checks a phasing, but shows no crossovers on trio-phased data, where HP1 is paternal by construction; it needs a per-cell value path. Read before proposing parent-of-origin or phasing-check coloring.
---

# Parent-of-origin coloring of haplotype cells

With a pedigree loaded ([ADR-279](../../architecture-decision-records/adr-279-a-pedigree-feeds-a-per-site-mendelian-check-and-the-assembly-states-transmission.md)),
each of a child's haplotype cells at an informative site (a parent's alleles
distinguish the two) could be colored by the parent whose allele it has:
paternal, maternal, or neither. A read-backed or statistically phased child
would then show switch errors as a haplotype row changing parent mid-block.

Why it was parked:

- **Trio-phased data shows nothing.** The 1000 Genomes KHV trio VCF puts the
  paternal allele first: HP1 matches the father at 82,679 informative chr1
  sites and the mother at 1,030. A crossover changes which of a parent's two
  copies the child has, which this coloring cannot see, and which hap-ibd's
  painting in `analyze_trio.md` shows.
- **It needs a per-cell value.** A cell's hue resolves per site on the main
  thread (ADR-203). Parent of
  origin differs between a child's two haplotype cells at one site, so the
  worker would ship a per-cell code beside the genotype codes and the cell
  shader would read it.

The call: whether a phasing check for read-backed phasing (WhatsHap output
beside a pedigree) is a use worth the per-cell path, now that JBrowse leaves
trio analysis to outside tools (ADR-279, amended 2026-11-20).
