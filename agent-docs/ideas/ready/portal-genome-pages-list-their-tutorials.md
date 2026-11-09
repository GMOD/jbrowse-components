---
name: portal-genome-pages-list-their-tutorials
description: "A genomes.jbrowse.org genome page (`/ucsc/<db>/`, `/accession/<GCF>/`) lists the tutorials that load its hub, from an index this repo generates out of the hub config URLs the tutorials carry, which jb2hubs fetches at build. No hand-kept list on either side."
---

# Portal genome pages list their tutorials

Tutorials link the genomes.jbrowse.org page whose hub they load
([WEBSITE_WRITING.md](../../reference/WEBSITE_WRITING.md), the genomes.jbrowse.org
bullet). The other direction is missing: jb2hubs'
`website/src/pages/ucsc/[id].astro` names no tutorial.

## Shape

- **The tutorials are the source.** A generator here collects, per hub, every
  tutorial whose fences or links name `jbrowse.org/ucsc/<db>/` or a GenArk hub
  path (`jbrowse.org/hubs/genark/…/<accession>`), with its title and slug.
  Count a hub only where the page loads data from it, the same test the link
  rule uses, so a page that only mentions a genome stays off the list.
- **Publish it as a static JSON file with the website**, beside the other
  generated site data, and run it under `pnpm autogen`.
- **jb2hubs fetches it at build** and renders a short "Tutorials using this
  genome" list on the genome and accession pages. A fetch failure leaves the
  list out; the page still builds.

## Open in the doc, not blocking

- The file only reaches jbrowse.org/jb2 with a website deploy, which is
  Colin's call. Until one goes out, jb2hubs can read the file from GitHub main.
