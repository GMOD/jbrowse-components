---
title: Developer guide
sidebar_label: Overview
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
by anyone, not just the JBrowse core team. Most products load plugins at runtime, though it
isn't required.

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

- [Writing a no-build plugin](/docs/developer_guides/no_build_plugin)
- [Pluggable elements](/docs/developer_guides/pluggable_elements)
- [Writing a plugin](/docs/developer_guides/simple_plugin)
- [Theming](/docs/developer_guides/theming)

### Core concepts

- [Configuration schema](/docs/developer_guides/configuration_schema)
- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [Extension points](/docs/developer_guides/extension_points)
- [Dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
- [MST patterns](/docs/developer_guides/mst_patterns)
- [RPC and worker system](/docs/developer_guides/rpc_workers)

### Creating pluggable elements

- [Custom adapters](/docs/developer_guides/creating_adapter)
- [Add-track workflows](/docs/developer_guides/creating_addtrack_workflow)
- [Custom connections](/docs/developer_guides/creating_connection)
- [Custom track and display types](/docs/developer_guides/creating_display)
- [GPU displays](/docs/developer_guides/creating_gpu_display)
- [Text search adapters](/docs/developer_guides/creating_text_search_adapter)
- [Custom view types](/docs/developer_guides/creating_view)
- [Custom widgets](/docs/developer_guides/creating_widget)
- [Drawer widgets](/docs/developer_guides/drawer_widgets)
- [Top-level menu items](/docs/developer_guides/menus)
- [Plotting features in a custom display](/docs/developer_guides/plotting_features)
- [SVG export](/docs/developer_guides/svg_export)

### Advanced topics

- [PIF (Pairwise Indexed Format)](/docs/developer_guides/pif_format)
- [RefName aliasing](/docs/developer_guides/refname_aliasing)
- [Testing a plugin](/docs/developer_guides/testing_plugins)
