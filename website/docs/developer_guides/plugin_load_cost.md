---
title: What your plugin costs at load
description:
  A config that names your plugin downloads and evaluates all of it before
  anything draws — how to make that cost your registration rather than your
  whole bundle
guide_category: Plugins
sidebar_label: Load cost
---

JBrowse registers pluggable elements once, before it reads a session, so every
plugin a config names is fetched and evaluated on the way to the first frame. A
plugin that draws a multiple sequence alignment pays for its alignment renderer
on a visit that never opens one, and pays the parse again in each RPC worker.
Keeping that cost down to what registration actually needs is three decisions,
and the first two are in your build.

## Register lazily

A view or display type takes its state model either built or as a thunk, and the
thunk is what defers everything the model names. JBrowse's own test fixture for
this is the shortest statement of it:

<!-- include: test_data/split_plugin/index.js#register -->

```js
pluginManager.addViewType(() => {
  return new ViewType({
    name: 'SplitView',
    // A thunk, so this module's graph does not name ./viewModel.js and the
    // bundler is free to put it in another chunk. Passing
    // `stateModelFactory()` here instead would register the same view and
    // cost the whole chunk at install.
    stateModel: () => import('./viewModel.js').then(f => f.default()),
    ReactComponent: () => null,
  })
})
```

Register the component with `lazy()` for the same reason.

The cost of the thunk is that `session.addView('MyView')` refuses a type whose
model has not loaded, and says so. Use
[`launchView`](/docs/models/AbstractSessionModel), which loads the model and
then adds the view; your plugin's own menu items and extension points should
call it too. JBrowse preloads the types a session snapshot names before it
applies one, so a saved session opens normally.

Registration itself stays eager, and so does the config schema — the config
editor and the track union need it before any model exists.

## Split the bundle, or the thunk buys nothing

A `lazy()` and a state-model thunk only defer anything if the build emits more
than one file. Both official templates bundle to a single UMD file, and esbuild
inlines an internal dynamic import unless splitting is on — so a plugin can
write every deferral correctly and ship all of it in the entry.

Splitting needs the ESM format, so an esbuild config gains `format: 'esm'` and
`splitting: true`, and takes an `outdir` in place of its `outfile`. Everything
else — the entry point, the `globalExternals` plugin over
`@jbrowse/core/ReExports/list` — stays as it was.

Publish the entry as `esmUrl` and serve the whole `dist/` directory beside it;
the chunks resolve against the entry's own URL. JBrowse loads an ESM plugin with
a dynamic import on the main thread and in its RPC workers alike.

Two things to weigh before moving a published plugin off UMD. A UMD build can
carry a subresource-integrity hash and an ESM one cannot, because dynamic import
takes no integrity attribute. And the split holds only while nothing in the
entry's graph names the deferred side — one
`import { thing } from 'heavy-library'` at module scope in an extension point
puts the library back in the entry, and nothing in TypeScript, your linter or
your tests will say so. Read your bundler's metafile, not your source.

## Externalize everything the host serves

`@jbrowse/core/ReExports/list` names every specifier the running JBrowse hands
plugins at runtime — core, the display toolkit, React, MobX, Material UI. A
specifier your build does not externalize is a second copy of something already
on the page.

The trap is the version you build against. If you intersect that list with an
older floor so one bundle runs on every host, every specifier only the newer
host serves gets bundled, along with its whole relative closure. The plugin
store publishes a `jbrowseRange` per version, so a plugin can ship a build for
current JBrowse and keep an older one for older hosts rather than paying the
floor on every load.

## See also

- [](/docs/developer_guides/optimizations)
- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/imports_and_reexports)
- [The measured version of this page](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/RUNTIME_PLUGIN_BOOT_COST.md),
  taking one published plugin through all three
