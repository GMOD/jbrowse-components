---
name: tutorials-genomes-portal-crosslinks
description: "Tutorials and genomes.jbrowse.org pages link each other wherever they share a genome or dataset. Waiting: the Ag1000G build script moving onto the anoGam3 hub, odp's renamed Dryad copies, a syri link, and a per-assembly tutorial list on the portal."
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

- **`pangenome_ecoli.md`** builds its five assemblies from FASTA, so it gets
  no portal link. The portal has `/accession/<GCF>/` pages for only three of
  them (GCF_000005845.2, GCF_000007445.1, GCF_000008865.2), so it cannot load
  all five from hubs either.
- **`syri_synteny.md`** links only the Arabidopsis pangenome page.
- **`odp_linkage_groups_synteny.md`**: EMU and BFL match portal assemblies, but
  the Dryad copies rename every sequence, so hub tracks would not line up; RES
  and BIN are different assemblies.
- **`scripts/build_ag1000g_ld.sh`** still builds its own JBrowse on AgamP4
  from FASTA with the AgamP4.12 genes, while `ld_mosquitoes.md` now loads the
  anoGam3 hub, so its "Reproduce it" output differs from the page.
- **A `/ucsc/[id]` page listing its tutorials**: derive the list from the
  `jbrowse.org/ucsc/<id>` config URLs the tutorials carry, published as an index
  jb2hubs fetches, not a hand-kept list.
- The GRCh38.p14 GenArk hub decision is jb2hubs'
  `ideas/waiting-on-a-call/genark-retire-grch38-p14-hub.md`.
