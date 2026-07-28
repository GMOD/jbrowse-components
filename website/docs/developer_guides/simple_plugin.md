---
title: Writing a plugin
description: Scaffold a plugin from an official template
guide_category: Getting started
---

**TL;DR:** Clone an official template, follow its README, and copy from its
worked example. Templates ship a working build and a local JBrowse instance to
test against.

Plugins add new pluggable elements (views, tracks, displays, adapters, widgets,
etc.) and can modify application behavior by watching state. See
[pluggable elements](/docs/developer_guides/pluggable_elements) for the full
list of element types you can register.

## Official templates

| Template                                                                                   | Bundler |
| ------------------------------------------------------------------------------------------ | ------- |
| [jbrowse-plugin-esbuild-template](https://github.com/GMOD/jbrowse-plugin-esbuild-template) | esbuild |
| [jbrowse-plugin-template](https://github.com/GMOD/jbrowse-plugin-template)                 | rollup  |

They are otherwise the same: pnpm, vitest unit tests, and Puppeteer end-to-end
tests against a nightly JBrowse build. Pick esbuild for faster builds; rollup is
older and more widely referenced in existing examples.

Both ship a custom **view** (`src/HelloView`) as their worked example. For a
custom track/display, which is the more common case, scaffold from a template
and then follow [](/docs/developer_guides/plotting_features). Its complete
plugin lives in `example-plugins/score-example/`, and every code block in that
guide is generated from that source.

## What's in a plugin

A plugin is a class extending `Plugin` with `install()` and `configure()`
methods that register pluggable elements against the `pluginManager`. The
element-specific guides walk through each type:

- [Creating custom view types](/docs/developer_guides/creating_view)
- [](/docs/developer_guides/creating_display)
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Creating custom adapters](/docs/developer_guides/creating_adapter)
- [Creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter)
- [Creating custom widgets](/docs/developer_guides/creating_widget)
- [Creating custom connections](/docs/developer_guides/creating_connection)

For plugins that don't need a build step (e.g. jexl callbacks or small behavior
tweaks), see
[writing a no-build plugin](/docs/developer_guides/no_build_plugin).

## See also

- [](/docs/developer_guides/pluggable_elements)
- [](/docs/developer_guides/no_build_plugin)
- [](/docs/developer_guides/testing_plugins)
- [](/docs/developer_guides/imports_and_reexports)
