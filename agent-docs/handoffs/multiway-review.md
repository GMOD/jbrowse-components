---
name: multiway-review
description: The 2026-09-27 multi-way and Follow review landed split strands by default, Freeze lanes, gene names that ride a pan, the Follow search-box and ruler-edit fixes, taller demos (deployed), fainter bridge ribbons, the colour key clear of the lane scales and the reshot figures; left are the 17p clutter, Colin's call on the bridge ribbons and a trim of SyntenyFollow/CLAUDE.md.
---

Landed on main (commit subjects):

- "Multi-way lanes split their strands by default, where a lane has room for two rows"
- "Multi-way gene names move with their lanes through a pan and a lane's motion"
- "Multi-way lanes can be frozen, and a frozen lane slid by hand", and "A slide
  on a frozen lane moves what it draws, after its frozen pivot has left the view"
- "A search or a ruler region edit on a followed row takes the follow anchor",
  "A drag on a row a held navigation is landing on still takes the follow
  anchor", and "The ruler's Reverse region on a followed row stands, as its Flip
  does"
- "Multi-way demos are sized to the stack with its gene names", deployed with
  `scripts/deploy-demo.sh`; the hosted configs match `demos/`
- "The multi-way colour key sits left of the lane headers' scales"
  (`LegendMixin`'s `legendRight`)
- The 21 figures drawing multi-way lanes reshot and published.

The adversarial review of the Follow middleware and Freeze ran; what it found
is fixed above. Declined, each reachable only by a stack of rare conditions:

- A text search inside `navToResolvedSpan`'s `navToLocString` fallback holds
  its row in the `landing` map for the search, so the reader's own search on
  that row reads as the follow's. It needs a PAF naming a contig no alias maps,
  a text index, and typing during the search. A synchronous fallback fixes it,
  but costs the unit harness's fake rows a session; `SyntenyFollow/CLAUDE.md`
  says why the map stays regardless.
- A drag on a frozen lane during its own flip or re-align transition jumps by
  the unfinished share of the drag on release.

Next:

- **Colin's call:** "Multi-way ribbons across a lane that lacks their group draw
  fainter" is its own commit, to keep or revert. The figures carry it.
- **The 17p window stays cluttered.** Each starburst is one composed record
  drawn as ~150 one-pixel tiles between a lane at 3× and one at 1×. Merging
  indels under 3 px and putting every lane at the anchor's scale were both
  tried and reverted; untried: one band per composed record at overview zoom,
  adjacent lanes held to one rung, a sideways-travel fade.
- `SyntenyFollow/CLAUDE.md` still narrates past behaviour in ~20 paragraphs; a
  trim is its own doc pass.
