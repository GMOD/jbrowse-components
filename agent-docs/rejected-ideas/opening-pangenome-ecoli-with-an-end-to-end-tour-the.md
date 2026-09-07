---
name: opening-pangenome-ecoli-with-an-end-to-end-tour-the
description: Opening `pangenome_ecoli` with an end-to-end tour, the way `pangenome_hprc` opens
area: comparative-and-pangenome
---

# Opening `pangenome_ecoli` with an end-to-end tour, the way `pangenome_hprc` opens

declined 2026-08-16 and the decline stands. The
page's subject is the linear projections and the graph is the last of its six
sections, so a tour at the top would open the page on what it covers last; its
clips sit in the sections that explain them, which is where the HPRC one was
wrong and these are right.

**Pasting the track config inside those clips was declined with it, and that
half was reversed on request 2026-08-21.** Both E. coli graph sections now open
with a clip that pastes the page's own fence and then launches
(`pangenome/pggb_subgraph_launch`, `pangenome_cactus/subgraph_launch`), each
still in its section rather than at the top. The cost the 2026-08-16 note
predicted was paid rather than dodged, and it is what to weigh before
reworking these: a pasted lane draws in the default colour, so the clip no
longer shows the lane and the graph sharing a ramp, and its caption no longer
says they do. Neither repair works. The ramp is two window constants, which
`pangenome_hprc` already says belongs on the view and not in a config a reader
pastes; and the rank jexl HPRC's fence carries does not transfer, because only
rank 0 has reference coordinates, so a K12 lane under it is one flat colour.
The correspondence is carried by the page's stills and by
`pangenome/pggb_layout_switch`, whose session still applies the ramp.
