---
name: blat-moves-to-the-plugin-store
description: "BLAT left this repo for GMOD/jbrowse-plugin-blat (~/src/jb2plugins/jbrowse-plugin-blat) on 2026-11-03 and loads from the plugin store as an unlisted entry, named by every genomes.jbrowse.org config. Left: reshoot the three Desktop BLAT figures, which show the dialog's removed apiKey field."
---

# BLAT moves to the plugin store

Colin (2026-11-03): BLAT belongs only on UCSC-capable instances such as
genomes.jbrowse.org, and should be fixable without a JBrowse release. It now
lives in GMOD/jbrowse-plugin-blat, releases with `pnpm version patch` there, and
the store (`~/src/jbrowse-plugin-list`) hosts it `unlisted`; jb2hubs names it
by `storePlugin: 'Blat'` (`hubtools/src/enhanceConfig.ts`). The daily proxy
canary runs from that repo.

## Left

- Reshoot `desktop-blat-steps.png`, `desktop-ispcr.png` and
  `desktop-ispcr-results.png` (`products/jbrowse-desktop/test/screenshots.ts`):
  they show the advanced settings' apiKey field, which the dialog no longer has.
  Desktop now loads BLAT from the hg19 hub config the recipe opens.
