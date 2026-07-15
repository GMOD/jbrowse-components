---
title: Writing a plugin
description: Scaffold a plugin from an official template
guide_category: Getting started
---

Plugins add new pluggable elements (views, tracks, adapters, renderers, widgets,
etc.) and can modify application behavior by watching state. See the
[pluggable elements](/docs/developer_guides/pluggable_elements) page for the
full list of element types you can register.

The fastest way to start is to clone one of the official templates. Each ships
with a working build, a local JBrowse instance to test against, and an example
pluggable element you can copy from. Follow the README in the template repo for
step-by-step setup.

## Official templates

| Template                                                                                   | Bundler | Package manager | Testing                |
| ------------------------------------------------------------------------------------------ | ------- | --------------- | ---------------------- |
| [jbrowse-plugin-esbuild-template](https://github.com/GMOD/jbrowse-plugin-esbuild-template) | esbuild | pnpm            | vitest + Puppeteer E2E |
| [jbrowse-plugin-template](https://github.com/GMOD/jbrowse-plugin-template)                 | rollup  | yarn/npm        | Jest                   |

The esbuild template is recommended for new plugins: faster builds and
end-to-end tests against JBrowse nightly builds. The rollup template is older
but more widely referenced in existing examples. Both follow the same plugin
structure, so the guides here apply to either.

## What's in a plugin

A plugin is a class extending `Plugin` with `install()` and `configure()`
methods, where you register your pluggable elements against the `pluginManager`.
The element-specific guides walk through each type:

- [Creating custom view types](/docs/developer_guides/creating_view)
- [Custom track and display types](/docs/developer_guides/creating_display)
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Creating custom adapters](/docs/developer_guides/creating_adapter)
- [Creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter)
- [Creating custom widgets](/docs/developer_guides/creating_widget)
- [Creating custom connections](/docs/developer_guides/creating_connection)

For plugins that don't need a build step (e.g. jexl callbacks or small behavior
tweaks), see
[writing a no-build plugin](/docs/developer_guides/no_build_plugin).

## See also

- [Pluggable elements](/docs/developer_guides/pluggable_elements) - overview of
  every element type a plugin can register
- [Writing a no-build plugin](/docs/developer_guides/no_build_plugin) - the
  alternative path when a build step isn't needed
- [Testing a plugin](/docs/developer_guides/testing_plugins) - Jest/Vitest setup
  for the templates above
- [Dependencies and re-exports](/docs/developer_guides/imports_and_reexports) -
  what the bundler externalizes versus what your plugin bundles itself
