---
status: Rejected
summary: "The pangenome tutorials keep each genome in its own coordinates and add no union ('pangenome coordinates') axis. odgi flatten over a K12-anchored order gives the E. coli graph a working 8.3 Mb union axis, but the synteny stack and haplotype lanes already give non-reference sequence width at citable positions, and the axis needs a house ordering script"
---

# ADR-228: The pangenome tutorials keep per-genome coordinates

## Status

Rejected (2026-10-12), after a spike on the E. coli pggb graph. MaizeGDB's odgi
plots in graph coordinates prompted it.

## Context

Every presence track in the pangenome tutorials is projected onto a reference.
`odgi pav` over K12 windows draws nothing for sequence K12 lacks. A union axis
holds each graph node once as one assembly, with a presence row per strain, so
every strain's islands get width.

The spike ran on the 2026-10-11 pggb rebuild
(`ada:~/data/ecoli-pggb-rebuild-2026-10-11/build/pggb/*.smooth.final.og`, odgi
0.9.4):

- `odgi flatten -f pan.fa -b pan.bed` takes 1.7 s. The union is 8.34 Mb against
  genomes of 4.6-5.5 Mb; 3.7 Mb of it is absent from K12, and 738 kb of that is
  shared by two or more other strains.
- On a K12-anchored order, Sakai has 1.27 Mb K12 lacks and K12 has 0.44 Mb
  Sakai lacks (runs >= 50 bp), close to Perna et al. 2001's 1.34 Mb of
  O-islands and 0.53 Mb of K-islands between O157 EDL933 and K12.
- Plotted as strain position against union position, all five strains run on
  one diagonal; IAI39's inversions near union 3.3-4.3 Mb and 7.0-7.3 Mb draw as
  anti-diagonals.

**Stock odgi does not give that order:**

- pggb's `-p Ygs` sort, with or without `odgi groom` first, leaves a sawtooth of
  blocks, every other one reversed against every genome; 53-60% of each
  strain's steps go left.
- `odgi sort -p Ygs -H k12.txt` after `odgi groom -R k12.txt` orders K12's
  nodes, but SGD has no terms for the 0.9 Mb no K12 path touches and leaves it
  past 7.45 Mb, away from its flanks.
- An explicit `odgi sort -s order.txt` works: each K12 node keyed by K12's
  first visit, each other node slotted after the last K12 node its walk passed,
  ties broken by the walk's bp offset. K12's steps never go left.

## Decision

Don't add a union axis to the tutorials, as a section or a hosted track:

- **The tutorials already give non-reference sequence width.** The five-strain
  synteny stack in `pangenome_cactus.md` and the HPRC haplotype lanes in
  `pangenome_hprc_haplotypes.md` draw each genome in its own coordinates,
  aligned to its neighbours, so a reader can cite a position and a graph
  rebuild leaves it alone. A union axis moves every coordinate on each rebuild.
- **The host prep fails the tutorial bar.** It needs our ordering script, a
  flatten, a BED-to-PAF conversion so genes reach the axis through a synteny
  view, and gap merging, since SNP bubbles chop the shared backbone (K12 and
  Sakai share 10 runs over 1 kb).
- **`odgi viz` already shows graph order.** `pangenome_cactus.md` sets its
  figure against K12's coordinates; a union axis in JBrowse adds a ruler and
  zoom to the same picture.
- **It does not reach human scale.** At HPRC scale, each SNP allele adds union
  width and splits genes.

## Consequences

The 3.7 Mb a K12 projection leaves out is a fair caveat for the per-strain
presence section of `pangenome_ecoli.md`, pointing at the synteny stack.

Opening insertions per window on the reference axis, as IGV's expanded
insertions do, stays open. It keeps reference coordinates and genes and needs
no global order, and it would serve MAF and the graph plugin's walk rows, which
draw each haplotype's bars as its own lengths.
