---
name: restack
description: The restack_around_locus tour and its tutorial text still move grape into the middle, where the launch dialog has put it since toPanelRows (a91fb851b0), so the tour's down-arrow on row 1 now moves grape to the bottom. Needs a new story, the page text and a re-film.
---

Since `toPanelRows` (`LaunchSyntenyView/panelOrder.ts`, `a91fb851b0`) a
two-mate launch opens peach / grape / cacao. Still written against the old
order:

- `website/scripts/videos/synteny.ts`, the `synteny/restack_around_locus` tour:
  its comment block, its `description`, the "The reference opens on top" delay
  and the "Move grape between peach and cacao" click on
  `panelArrow(restackAnchor, 1, 'down')`, which now moves grape to the bottom.
- `website/docs/tutorials/multiway_synteny_grape_peach_cacao.md`, the scale-bar
  route's "moving grape between peach and cacao" and the video caption's "one
  arrow moves the reference into the middle".

The tour needs a new story (the dialog already in the right order, and the
`unconfigured` line), the page text to match, and a re-film.
