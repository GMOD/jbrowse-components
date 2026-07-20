# JBrowse 2

[![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/jbrowse-components/push.yml?branch=main&logo=github&style=for-the-badge)](https://github.com/GMOD/jbrowse-components/actions)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-adopted-ff69b4.svg?style=for-the-badge)](CODE_OF_CONDUCT.md)

JBrowse 2 is a pluggable, open-source genome browser. It runs as a web app, a
desktop app (Mac, Windows, Linux), and as embeddable React components, and
supports linear, circular, dotplot, synteny, and spreadsheet views, with track
types for alignments (BAM/CRAM), variants and structural variants,
quantitative/coverage, and more.

The web app is "static-site compatible" — it is pure client-side JS, CSS, and
HTML, so it can be hosted anywhere with no server. The stack is React,
TypeScript, and @jbrowse/mobx-state-tree.

## Installing and running

- Desktop app: [downloads](https://jbrowse.org/jb2/download/)
- Web app: [web quickstart](https://jbrowse.org/jb2/docs/quickstart_web/)
- Embedded React components:
  [embed a Linear Genome View](https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/)

## Documentation

- [Documentation home](https://jbrowse.org/jb2/docs/) — user guide, config
  guide, developer guide, and CLI reference
- [Tutorials](https://jbrowse.org/jb2/docs/tutorials/) — step-by-step guides
  grouped by topic (synteny, structural variants, methylation, RNA-seq, and
  more)
- [FAQ](https://jbrowse.org/jb2/docs/faq/)

## Examples

- [Live demos](https://jbrowse.org/jb2/demos/) — hosted, interactive instances
- [Gallery](https://jbrowse.org/jb2/gallery/) — screenshots of the views and
  track types
- [Feature list](https://jbrowse.org/jb2/features/)

## Contact

- [Homepage](https://jbrowse.org/jb2/)
- [Contact and office hours](https://jbrowse.org/jb2/contact/)

## Publications

- _JBrowse 2: a modular genome browser with views of synteny and structural
  variation_ (2023)
  https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02914-z
- _Setting up the JBrowse 2 genome browser_ (2024)
  https://currentprotocols.onlinelibrary.wiley.com/doi/full/10.1002/cpz1.1120
- _Setting up JBrowse 2 for Visualizing Genome Synteny_ (2025)
  https://currentprotocols.onlinelibrary.wiley.com/doi/full/10.1002/cpz1.70236
- _Proteins in the Genome Browser: Integration of Phylogenies, Alignments, and
  Structures With Nucleotide-level Evidence in JBrowse 2_ (2026)
  https://www.sciencedirect.com/science/article/abs/pii/S0022283626000185

## Contributing

See [CONTRIBUTING.md](/CONTRIBUTING.md) to get set up.
`agent-docs/ARCHITECTURE.md` describes the rendering pipeline and core
architecture.
