---
name: graph-figures-after-plugin-10-8
description: "Graph figures not yet squared with graph plugin 10.8.0 (live 2026-11-23): the fly thread section and its ada-only walk file, three published figures that reshoot differently, three failing E. coli rGFA specs, thirteen unreviewed reshoots. The paper's figures are unaffected."
---

# Graph figures after plugin 10.8.0

Graph plugin 10.8.0 is what jbrowse.org's hosted `latest` bundle has served
since 2026-11-23. It carries 10.7.0's thread folding, which names each
unbranched run as one node: `487908~488222+` for a reference run,
`ins:<segment before>:<bp>[:<segment after>]+` for a walk's own path. A spec
anchored on a plain segment id inside a folded run resolves to nothing.

The work is six unlanded commits ending at `730f394478`, rebased onto main at
`2fa1c07450`, with nothing published. The pictures
behind each item are at <https://claude.ai/artifact/8Sf9NhDp8XmGkE18Ay59am>.

Colin answered "your choice" to the open calls on 2026-11-23, so the choices
below are the agent's, taken on that delegation. He also said the paper comes
first and none of this blocks it.

## The paper is clear

`paper/cohort_views`, `paper/hprc_lanes_graph_stacked_force` and
`paper/hprc_rows_graph_vs_minimap2` reshot against 10.8.0 byte-identical to
`~/paper/figures/png/` (Figures 4, 6b and S12). The paper's non-graph figures
were not reshot, so the gene-label item below is unchecked for them.

## Next

- **Move the fly walk file to jbrowse.org.** The thread specs read
  `extra_test_data/flywalks/fly_walks.json`, untracked files in the
  `ada:~/jbshoot/` worktree that shot `730f394478`, which `jb-ada-prune`
  removes after 7 idle days. A copy that survives the prune is in
  `ada:/mnt/sdb/cdiesh/flyPangenome/walks-for-figures/`
  (`fly-dm6-mc.dm6.walks.gz`, its `.idx`, the config). Upload beside the fly
  demo, repoint `WALKS_CONFIG` in `website/scripts/specs/graph-rice-fly.ts`,
  reshoot.
- **Write the "follow each assembly" section of `pangenome_fly.md` for Cyp28d1
  and Strn-Mlck**, from `pangenome/fly_cyp28d1_threads` and
  `pangenome/fly_strn_mlck_threads`. Both shoot cleanly and were read after
  the last placement. Then publish the two figures and land the branch.
- **CHKov1's thread figure ships with its "no thread" callout; the chr3-split
  rebuild is not run.** SAM_HiFi names chromosome 3 as one molecule, the
  Minigraph-Cactus build binned it as ambiguous, and it has a callset row with
  no walk. Splitting chr3 into arms and rebuilding is about 9 hours on ada and
  changes that one row. In `pangenome/fly_chkov1_threads` the "six strains walk
  straight past it" callout reaches the arc over the Doc by a fixed 60 px
  offset from the Doc node, so re-measure it if the layout moves.
- **Three published figures reshoot as different pictures; hold them out of
  any publish until someone rules on the look.** Their specs passed a top-level
  `color` the plugin stopped reading in 9.1.0, which the capture now refuses as
  an unknown key. The branch respells 11 sites as `encoding.color`. How much of
  each change is the key now being read and how much is plugin drift since the
  published shot is not separated:
  - `pangenome_cactus/graph_bubble`: the 776 bp node arcs up with the skip
    beneath it, and the callout covers the key. Needs the callout moved.
  - `pangenome/graph_kiv2_walk_rows`: the orange abridged stretches and their
    key row are gone. Try the spec without `encoding.color: { value: 'uniform'
    }` first, since the published shot was taken with that key ignored.
  - `pangenome/graph_mouse_nnt_halos`: grey bubbles labelled by route count
    replace the blue insertion halos, and the ramp spans 278 kb, not 160 kb.
- **Three E. coli rGFA specs fail, each differently, not diagnosed**:
  `pangenome/rgfa_subgraph_launch` draws "CFT073 only, not in K12" off the left
  edge, `pangenome/rgfa_strain_launch` never shows "Open in CFT073" (which
  blocks the `pangenome/rgfa_launch_roundtrip` compose), and
  `pangenome/rgfa_hover_sync` never shows `graph-node-highlight`.
- **Thirteen reshoots came back changed and nobody has looked at them**:
  `maf_hprc_pangenome`, `multiway_synteny/ecoli_one_vs_all`,
  `pangenome/graph_context_none`, `pangenome/graph_context_hop1`,
  `pangenome/graph_kiv2_walks`, `pangenome/hprc_c4_panels`,
  `pangenome/hprc_c4_threads`, `pangenome/hprc_graph_anatomy`,
  `pangenome/hprc_graph_vs_callset`, `pangenome/hprc_haplotype_launch`,
  `pangenome/hprc_lpa_kiv2`, `pangenome/mouse_dock2` and
  `pangenome/rgfa_paa_bubble`. A callout pointing at the wrong place shoots
  without error. Read each against its published copy before a publish.

## Not this thread

`~/src/jbrowse-plugin-graphgenomeviewer`'s primary checkout has two old
unpushed local commits (oxlint, oxfmt) and sat 262 behind origin when 10.8.0
was released by hand. Left alone.
