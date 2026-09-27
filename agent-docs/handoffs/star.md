---
name: star
description: The gene-page "☰ Multi-way synteny lanes" link and hg38's star are staging-only until JBrowse 5 ships; genomes_synteny's "Many genomes at once" links staging and moves to production with them.
---

- **Production, once a released host carries `MultiWaySyntenyDisplay`:**
  jb2hubs flips `features.multiwayStar` and uploads the star in
  `config.json`, then `genomes_synteny.md` "Many genomes at once" drops its
  staging sentence, points at `genomes.jbrowse.org/gene/?gene=TNNT3` and
  `/ucsc/hg38/config.json`, and both `genomes_synteny/star_*` specs follow.
