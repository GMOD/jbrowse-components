---
name: star
description: The gene-page "☰ Multi-way synteny lanes" link and hg38's star are staging-only until JBrowse 5 ships; genomes_synteny's "Many genomes at once" links staging and moves to production with them. jb2hubs ef6690ca4e2 (34 px lane pitch) is pushed but not deployed.
---

- **Staging runs the old lane pitch.** jb2hubs `ef6690ca4e2` sizes the link's
  track at 34 px per lane, the display's no-scroll floor with gene names; the
  deployed build uses 22, so TNNT3's 26 lanes open in a 594 px track that
  scrolls. It needs a staging website deploy (`./run.sh --staging
  --upload-only` on ada). `genomes_synteny/star_lanes` already draws the fixed
  height.
- **Production, once a released host carries `MultiWaySyntenyDisplay`:**
  jb2hubs flips `features.multiwayStar` and uploads the star in
  `config.json`, then `genomes_synteny.md` "Many genomes at once" drops its
  staging sentence, points at `genomes.jbrowse.org/gene/?gene=TNNT3` and
  `/ucsc/hg38/config.json`, and both `genomes_synteny/star_*` specs follow.
