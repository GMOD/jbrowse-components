---
title: Developer guide
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
community plugin registry — browse it to find published plugins or submit your
own via pull request.

## Developer guides

### Getting started

- [Writing a no-build plugin](/docs/developer_guides/no_build_plugin) - Plugin without a build step, useful for jexl callbacks and simple modifications
- [Pluggable elements](/docs/developer_guides/pluggable_elements) - Overview of all element types a plugin can register
- [Writing a plugin using jbrowse-plugin-template](/docs/developer_guides/simple_plugin) - Step-by-step plugin setup using the official rollup template
- [Theming](/docs/developer_guides/theming) - Customizing JBrowse colors and theme via config

### Core concepts

- [Configuration model basics](/docs/developer_guides/config_model) - Config slot types, defaults, and how configuration schemas work
- [Configuration schema](/docs/developer_guides/configuration_schema) - Slot types, inheritance, preProcessSnapshot, and reading config values
- [Data fetching pipeline](/docs/developer_guides/data_fetching) - How BaseLinearDisplay fetches data, the autorun chain, and rpcProps
- [Extension points](/docs/developer_guides/extension_points) - Callbacks registered by producers and consumed across the app
- [MST patterns](/docs/developer_guides/mst_patterns) - Common MobX-State-Tree patterns used across JBrowse plugins
- [Renderer architecture](/docs/developer_guides/renderer_architecture) - GPU main-thread rendering and the legacy worker-renderer path
- [RPC and worker system](/docs/developer_guides/rpc_workers) - How to register and call RPC methods that run in web workers

### Creating pluggable elements

- [Creating custom adapters](/docs/developer_guides/creating_adapter) - Read data from custom file formats with feature, regions, or sequence adapters
- [Creating custom add-track workflows](/docs/developer_guides/creating_addtrack_workflow) - Custom UI in the Add track dialog for non-standard track types
- [Creating custom display types](/docs/developer_guides/creating_display) - Control how a track renders in a given view type
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display) - Build a display that renders with WebGPU/WebGL2 and falls back to Canvas2D
- [Creating custom renderers](/docs/developer_guides/creating_renderer) - Write canvas- or SVG-based feature rendering in a web worker
- [Creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter) - Implement a custom backend for the search box
- [Creating custom track types](/docs/developer_guides/creating_track) - Define new high-level track concepts backed by display types
- [Creating custom view types](/docs/developer_guides/creating_view) - Add entirely new view panels such as DotplotView or CircularView
- [Creating custom widgets](/docs/developer_guides/creating_widget) - Add new drawer/panel UI components
- [Drawer widgets in embedded components](/docs/developer_guides/drawer_widgets) - Launching sidebar or popup widgets in the embedded LGV
- [Creating custom top-level menu items](/docs/developer_guides/menus) - Add items to the top-level application menu bar
- [Adding SVG export to a display](/docs/developer_guides/svg_export) - How to implement renderSvg on a custom display type

### Advanced topics

- [PIF (Pairwise Indexed Format)](/docs/developer_guides/pif_format) - Tabix-indexed pairwise alignment format for large-scale synteny data
- [RefName aliasing](/docs/developer_guides/refname_aliasing) - Map between chromosome naming conventions across tracks and assemblies
