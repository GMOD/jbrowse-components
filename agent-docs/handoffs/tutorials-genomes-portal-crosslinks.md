---
name: tutorials-genomes-portal-crosslinks
description: "Tutorials and genomes.jbrowse.org pages link each other wherever they share a genome or dataset. Waiting: staging links in genomes_synteny and pangenome_mouse, the E. coli pages, odp's renamed Dryad copies, ld_mosquitoes on AgamP4, and a per-assembly tutorial list on the portal."
---

# Tutorials and genomes portal cross-links

Check this list before adding a tutorial on a hosted genome or a new portal
page, and update it as links land.

## The pattern

- Take each lane's assembly and gene track verbatim from its hub (`hub_parts`
  in `build_primate_orthologs.sh` and `build_hg38_liftover_multiway.sh`).
- A GenArk hub's `refNameColumnHeaderName: "ucsc"` makes UCSC names canonical,
  so a spec's `displayedRegionNames` says `chr12`, not the NCBI name.
- A hosted config must still boot on the host floor the portal serves
  (v4.3.0, the latest v5 tag and main).

## Open

- **Staging links**: `genomes_synteny.md` (the conserved-gene-order page, mm39)
  and `pangenome_mouse.md` (mm39) link `staging.genomes.jbrowse.org`; repoint
  each once the page is live on genomes.jbrowse.org.
- **Not converted**: `pangenome_ecoli.md`; `syri_synteny.md` links only the
  Arabidopsis pangenome page.
- **`odp_linkage_groups_synteny.md`**: EMU and BFL match portal assemblies, but
  the Dryad copies rename every sequence, so hub tracks would not line up; RES
  and BIN are different assemblies.
- **`ld_mosquitoes.md`** reads AgamP4; the portal has only AgamP3 (anoGam3).
- **A `/ucsc/[id]` page listing its tutorials**: derive the list from the
  `jbrowse.org/ucsc/<id>` config URLs the tutorials carry, published as an index
  jb2hubs fetches, not a hand-kept list.
- The GRCh38.p14 GenArk hub decision is jb2hubs'
  `ideas/waiting-on-a-call/genark-retire-grch38-p14-hub.md`.
