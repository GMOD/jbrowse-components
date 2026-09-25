---
name: star
description: The gene-page link to the multi-way synteny star is on staging; the genomes_synteny tutorial section is planned but not written.
---

The gene-page link to the multi-way star is live on staging, but I haven't written the tutorial yet: I stopped to save tokens.

- Staging: deployed from ada with ./run.sh --staging --upload-only. The "☰ Multi-way synteny lanes" link is on staging.genomes.jbrowse.org's gene pages; ./deploy.sh --staging --rollback undoes it. I checked only that the site answers. I haven't clicked the link on staging yet; my earlier end-to-end test ran against a local copy of the site.
- Tutorial: planned but not started.
  - Where: a section in genomes_synteny.md after "Trying other pairs".
  - Story: it follows that page's TNNT3 thread, from the staging /gene?gene=TNNT3 page through the new link to hg38's star.
  - Figures: two new figures in website/scripts/specs/synteny.ts. One shows the staging page with the link boxed; the other shows the JBrowse view the link opens.

  The full plan is in the multiway thread memory.
- Left in place: a jbrowse-components checkout on ada, ~/src/jbc-genomes-synteny-star, with a jbrowse-web build started for capturing the figures.

On "no remote for ada": jb2hubs works exactly as you said, and I pulled ~/src/jb2hubs on ada before deploying. My remark was about jbrowse-components, where the tutorial branch existed only on this laptop, so I pushed it to ada's checkout directly rather than through GitHub.
