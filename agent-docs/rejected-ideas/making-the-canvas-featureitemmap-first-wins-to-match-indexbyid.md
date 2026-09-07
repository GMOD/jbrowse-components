---
name: making-the-canvas-featureitemmap-first-wins-to-match-indexbyid
description: Making the canvas `featureItemMap` first-wins to match `indexById`
area: rendering-and-displays
---

# Making the canvas `featureItemMap` first-wins to match `indexById`

tried
2026-08-11 and reverted. The two tables resolve a region-spanning feature
differently on paper, but `laidOutDataMap` is the LAID-OUT map and the packer
gives such a feature one row across its whole ref-group, so both copies carry
identical geometry before either table is built. A test written to catch the
difference passes against both spellings. The existing comment had already
reached that conclusion deliberately.
