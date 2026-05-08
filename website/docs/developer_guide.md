---
id: developer_guide
title: Developer guide
toplevel: true
---

This guide covers how JBrowse 2 code is packaged and structured, and how to
create new plugins and pluggable elements.

## Products and plugins

The JBrowse 2 ecosystem has two main types of top-level artifacts that are
published on their own: products and plugins.

<Figure src="/img/products_and_plugins.png" caption="Architecture diagram of JBrowse 2, showing how plugins encapsulate views (e.g. LinearGenomeView, DotplotView etc.), tracks (AlignmentsTrack, VariantTrack, etc.), adapters (BamAdapter, VcfTabixAdapter, etc.) and other logic like mobx state tree autoruns that add logic to other parts of the app (e.g. adding context menus)"/>

A "product" is an application of some kind that is published on its own (a web
app, an electron app, a CLI app, etc). `jbrowse-web`, `jbrowse-desktop`, and
`jbrowse-cli` are products.

A "plugin" is a package of functionality that is designed to "plug in" to a
product **at runtime** to add functionality. These can be written and published
by anyone, not just the JBrowse core team. Not all of the products use plugins,
but most of them do.

<Figure src="/img/product_architecture.png" caption="This figure summarizes the general architecture of our state model and React component tree"/>

## Example plugins

Plugin templates:

- [jbrowse-plugin-template](https://github.com/GMOD/jbrowse-plugin-template)
- [jbrowse-plugin-esbuild-template](https://github.com/GMOD/jbrowse-plugin-esbuild-template)
  (lightweight esbuild-based alternative)

Working plugin examples:

- [jbrowse-plugin-ucsc-api](https://github.com/cmdcolin/jbrowse-plugin-ucsc-api)
  probably the simplest plugin example, it demonstrates accessing data from UCSC
  REST API
- [jbrowse-plugin-gwas](https://github.com/cmdcolin/jbrowse-plugin-gwas) a
  custom plugin to display manhattan plot GWAS data
- [jbrowse-plugin-biothings-api](https://github.com/cmdcolin/jbrowse-plugin-biothings-api)
  demonstrates accessing data from mygene.info, part of the "biothings API"
  family
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview) -
  demonstrates creating a custom view type that doesn't use any conventional
  tracks
- [jbrowse-plugin-gdc](https://github.com/GMOD/jbrowse-plugin-gdc) demonstrates
  accessing GDC cancer data GraphQL API, plus a custom drawer and track type for
  coloring variants by impact score
- [jbrowse-plugin-systeminformation](https://github.com/garrettjstevens/jbrowse-plugin-systeminformation)
  demonstrates using desktop specific functionality, accessing system node
  libraries. This desktop specific functionality should use the CJS bundle type
  (electron doesn't support ESM yet)

These show how plugins are structured and can serve as templates for your own
pluggable elements.

The [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list) is the
community plugin registry — browse it to find published plugins or submit your
own via pull request.
