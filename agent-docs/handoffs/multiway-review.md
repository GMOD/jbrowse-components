---
name: multiway-review
description: The 2026-09-27 multi-way and Follow review landed split strands by default, Freeze lanes with per-lane sliding, gene names that ride a pan, the Follow search-box and ruler-edit fixes, demo heights for the gene-name row, and fainter bridge ribbons; left are an adversarial review of the Follow middleware and Freeze, demo deploys, figure reshoots and the 17p clutter.
---

Landed on main (commit subjects):

- "Multi-way lanes split their strands by default, where a lane has room for two rows"
- "Multi-way gene names move with their lanes through a pan and a lane's motion"
- "Multi-way lanes can be frozen, and a frozen lane slid by hand"
- "A search or a ruler region edit on a followed row takes the follow anchor", and
  "A drag on a row a held navigation is landing on still takes the follow anchor"
- "Multi-way demos are sized to the stack with its gene names"
- "Multi-way ribbons across a lane that lacks their group draw fainter" — Colin's
  call to keep or revert; its own commit.

Next:

- **Run an adversarial review of the Follow middleware and Freeze.** One was
  started and did not report before the session ended. Attack the per-row
  `landing` map in `installSyntenyFollow.ts` (a held navigation whose tail
  escapes it, an entry that never clears, `appendRow` and the launch's
  `placeRow`) and Freeze's writes to `frozenLanes` (re-anchor, a flipped view,
  hide and reorder, undo steps per slide, `laneDragPx` over a running lane
  transition).
- **Deploy** `demos/ecoli_orthologs`, `demos/hg38_vertebrates` and
  `demos/hprc_multiway` with `scripts/deploy-demo.sh`; their heights changed to
  34 px a lane. Not deployed, since the hosted configs also serve the release.
- **Reshoot the multi-way figures.** Split strands and gene names change most of
  them, and `multiway_synteny/ecoli_symbol_oantigen`'s 1,100 px spec now scrolls.
- **The 17p window stays cluttered.** Each starburst is one composed record
  drawn as ~150 one-pixel tiles between a lane at 3× and one at 1×. Merging
  indels under 3 px and putting every lane at the anchor's scale were both tried
  and reverted; untried: one band per composed record at overview zoom, adjacent
  lanes held to one rung, a sideways-travel fade.
- The colour key covers the top lanes' scale labels on the E. coli stack;
  `LegendMixin`'s `legendTop` is the hook.
- `SyntenyFollow/CLAUDE.md` still narrates past behaviour in ~20 paragraphs; a
  trim is its own doc pass.
