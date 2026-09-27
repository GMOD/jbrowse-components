---
name: star
description: The gene-page "☰ Multi-way synteny lanes" link is on staging.genomes.jbrowse.org, not production. The genomes_synteny tutorial section it needs is unwritten - the TNNT3 thread through the link to hg38's star, with two figures.
---

- **The link** is on staging's gene pages and not on production;
  `./deploy.sh --staging --rollback` in jb2hubs undoes it. Nobody has clicked
  it on staging; the end-to-end test ran against a local copy of the site.
- **The tutorial section** goes in `website/docs/tutorials/genomes_synteny.md`
  after "Trying other pairs". It follows that page's TNNT3 thread from
  `/gene?gene=TNNT3` through the link to hg38's star, with two new figures in
  `website/scripts/specs/synteny.ts`: the gene page with the link boxed, and
  the view it opens. It waits on the link reaching production.
