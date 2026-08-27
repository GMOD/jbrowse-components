---
slug: /
title: Introduction
description:
  JBrowse 2 is a pluggable open-source genome browser for the web, the desktop,
  and your own app. Start here.
---

JBrowse 2 is a pluggable, open-source genome browser that runs on the web, on
the desktop, and embedded in your own app. Data is organized into
[assemblies](/docs/config_guides/assemblies) (reference genomes) and
[tracks](/docs/config_guides/tracks) layered on top of them.

See the [visualization gallery](/gallery/), or hosted genomes at
[Genome Hubs](https://genomes.jbrowse.org/).

## Run JBrowse

- [JBrowse web](/docs/quickstart_web)
- [JBrowse desktop](/docs/quickstart_desktop)
- [](/docs/embedded_components)

## Use JBrowse

- [](/docs/user_guide)
- [Tutorials](/docs/tutorials)
- [Feature overview](/features/)
- [](/docs/faq)

## Configure and host

- [](/docs/config_and_session_json)
- [](/docs/config_guide)
- [](/docs/cookbook)
- [](/docs/config_guides/file_types)
- [Config reference](/docs/config)
- [@jbrowse/cli](/docs/cli)

## Embed and script

- [](/docs/automating)
- [](/docs/urlparams)
- [](/docs/jbrowser)
- [](/docs/jbrowse_anywidget)
- [@jbrowse/img](/docs/jbrowse-img)

## Extend JBrowse

- [](/docs/developer_guide)
- [](/docs/developer_guides/simple_plugin/)
- [State model reference](/docs/models)
- [](/docs/api)

## Prior art and credit

JBrowse 2 stands on the shoulders of many great scientists that came before us.
Points of reference:

- Savant genome browser: genome arcs
- Gap5 genome browser: the read cloud, a cousin of genome arcs
- [Mummerplots](https://jmonlong.github.io/Hippocamplus/2017/09/19/mummerplots-with-ggplot2/):
  auto-diagonalization routines for better synteny figures
- minimap2 and the PAF format: the basis our synteny visualizations are built on
- samtools and the hts-specs community: a continued substrate for complex
  bioinformatics formats like BAM, CRAM and VCF
- pggb, cactus and the other pangenome tool developers: for proving pangenomics
  works
- chain2paf, paftools.js and the rest of the ecosystem that grew around PAF
- jcvi/MCScan: the easy protein-alignment synteny workflow we standardized
  around, whose `.anchors` and `.blocks` formats other programs (the OrthoFinder
  workflow among them) use to this day
- ReactJS, TypeScript, mobx-state-tree and the JavaScript community: building a
  bioinformatics ecosystem on the web is hard when most of the field works in
  other languages
- IGV and igv.js: much of the alignments track, particularly read pairing and
  modBAM color schemes, view as pairs, and link supplementary alignments
- D-GENIES: for establishing a very high quality, easy to use dotplot viewer
- GenomeSpy and HiGlass/Gosling: for proving WebGL powered browsers
- [Every other genome visualization developer](https://cmdcolin.github.io/awesome-genome-visualization/?latest=true)

## Contact

Ask questions on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions),
report a bug on
[GitHub issues](https://github.com/GMOD/jbrowse-components/issues), or
[contact us](/contact) directly with suggestions and feedback.

Enjoy!
