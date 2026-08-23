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
custom track/display, scaffold from a template and then follow
[](/docs/developer_guides/plotting_features). Its complete plugin lives in
`example-plugins/score-example/`, and every code block in that guide is
generated from that source.

## What's in a plugin

A plugin is a class extending `Plugin`. `name` is the only required member; the
rest you implement as needed:

- **`install()`** — registers pluggable elements against the `pluginManager`.
- **`configure()`** — runs afterwards, typically to set up mobx autoruns over
  application state.
- **`version`** — what the plugin store shows beside the name.
- **`uninstall()`** — a hook nothing in JBrowse calls; don't put teardown in it.

The element-specific guides walk through each type:

<!-- doclist:developer_guides category="Plugins" -->

A plugin can also add its own **configuration slots**, through one of three
class members that differ only in where the slots land:

- `configurationSchema` nests them under the plugin's own `name`, so a slot
  reads as `configuration.MyPlugin.mySlot`. This is the one to reach for: the
  slots live in the plugin's own namespace.
- `configurationSchemaUnnamespaced` merges them into `configuration` directly.
- `rootConfigurationSchema` is a function of the plugin manager whose result is
  spread into the root config, for a schema that has to be built against what is
  registered.

For plugins that don't need a build step (e.g. jexl callbacks or small behavior
tweaks), see
[writing a no-build plugin](/docs/developer_guides/no_build_plugin).

## See also

- [](/docs/developer_guides/pluggable_elements)
- [](/docs/developer_guides/no_build_plugin)
- [](/docs/developer_guides/testing_plugins)
- [](/docs/developer_guides/imports_and_reexports)
