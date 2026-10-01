---
name: star
description: The gene-page "☰ Multi-way synteny lanes" link and hg38's star are staging-only until JBrowse 5 ships and the gene page's conserved-gene-order section goes to production; genomes_synteny's "Many genomes at once" links staging and moves with them.
---

- **Production, once a released host carries `MultiWaySyntenyDisplay`:**
  jb2hubs flips `features.multiwayStar` and uploads the star in
  `config.json`, then `genomes_synteny.md` "Many genomes at once" drops its
  staging sentence, points at `genomes.jbrowse.org/gene/?gene=TNNT3` and
  `/ucsc/hg38/config.json`, and both `genomes_synteny/star_*` specs follow.
- **The v5 release alone does not get the link to production.** It sits in the
  gene page's conserved-gene-order section, which jb2hubs gates separately on
  `features.multiSynteny` (staging, `website/src/config/features.ts`), and
  nothing there ties that flag to v5. Flipping `multiwayStar` without it
  renders nothing on genomes.jbrowse.org, and the tutorial's route ("scroll to
  **Conserved gene order**") has no section to scroll to.
