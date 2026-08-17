---
title: Developer guide
sidebar_label: Overview
description:
  How JBrowse 2 is packaged and structured, and how to write plugins and
  pluggable elements.
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
by anyone, not just the JBrowse core team. Most products load plugins at
runtime, though it isn't required.

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

Use these as references when building your own.

The [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list) is the
community plugin registry: browse it to find published plugins or submit your
own via pull request.

## Developer guides

### Getting started

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/no_build_plugin)
- [](/docs/developer_guides/pluggable_elements)

### Plugins

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/plotting_features)
- [](/docs/developer_guides/creating_gpu_display)
- [](/docs/developer_guides/creating_addtrack_workflow)
- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/creating_connection)
- [](/docs/developer_guides/creating_view)
- [](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/drawer_widgets)
- [](/docs/developer_guides/menus)
- [](/docs/developer_guides/svg_export)
- [](/docs/developer_guides/creating_text_search_adapter)

### Core concepts

- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/dataflow)
- [](/docs/developer_guides/imports_and_reexports)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/rpc_workers)

### Advanced topics

- [](/docs/developer_guides/optimizations)
- [](/docs/developer_guides/pif_format)
- [](/docs/developer_guides/refname_aliasing)
- [](/docs/developer_guides/testing_plugins)
- [](/docs/developer_guides/theming)
