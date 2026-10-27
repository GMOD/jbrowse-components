---
name: display-kit-external-surface
description: "What still fails silently for an external display built on @jbrowse/display-kit: a member-level contract no check outside the tree sees, a version pin that guards only types (a version gate at load is declined), chrome props with no check, and host-compat tooling copied across eight plugin repos. Read before changing a mixin member a plugin display reads, adding a display-kit subpath, or touching a plugin template's build."
---

# display-kit as an external-plugin surface

- **In:** `@jbrowse/display-kit`'s exports map, which ADR-128 serves whole to
  runtime plugins, and the external displays built on it (jb2plugins' arg and
  graph displays, `example-plugins/score-example`).
- **Out:** a check an external plugin can run for each rule the tree enforces
  on itself, and a plugin build that names an export its oldest supported
  host lacks.

Claim a step here before starting it.

## Findings (2026-10-27)

- **The exports map is mostly kit.** External displays import about 20 of the
  98 subpaths. Of the 21 with no importer outside display-kit, most serve an
  external display: the chrome overlays, the host contracts, the config-schema
  fragments, and modules whose types a published declaration names
  (FetchMixin's `fetchInputs: FetchInputs`; dropping one fails a plugin's
  declaration build with TS2742). Five were foundation machinery and left the
  map; the package README states the rule.
- **The external checks see names, and the contract is members.**
  `publishedPluginReads.json` records `module#name`. ARG's display reads
  `regionPayloads`, `canvasWidthPx`, `renderBlocks` and `hoveredFeature` off
  the foundation, and no check records those reads. ARG is not a store
  plugin, so its foundation imports go unrecorded too.
- **The tree's own display checks don't reach a plugin repo.**
  `no-restricted-syntax` in `eslint.config.mjs` (hooks in `.actions`) and
  `reloadReachesCounter.test.ts` scan only this tree. The runtime contract
  checks run in a plugin's jest, since only `NODE_ENV=production` strips them.
  They report through `console.error`, and `config/jest/contractGate.js`
  turns a report into a failure. `@jbrowse/display-test-utils` is private.
- **A runtime plugin cannot pin display-kit, and a version gate is declined.**
  The host serves its own copy. ARG builds against `5.0.0-beta.4` and runs on
  beta.18 hosts, so a gate on version would warn on or refuse plugins that
  work. The check is by name instead; PLUGIN_ABI_STABILITY.md's §"The real
  cure" item 2 has the ruling.
- **Chrome props are unchecked ABI, and the graph display needs none of
  them.** `jbrowse-plugin-graphgenomeviewer`'s `GraphStatusChrome.tsx`
  assembles its own chrome from four display-kit overlays and three
  display-ui hooks. It used `DisplayStatusChrome` until d8db736896 removed
  that. `DisplayChrome` lacks nothing it needs: `GraphCanvas` calls
  `useRenderingBackend` itself because the standalone graph view mounts it
  too, and `DisplayChrome` wants to own that call. Beta.18 serves
  `DisplayChrome`, the plugin's floor.
- **The host-compat tooling lives in the plugins.** Eight jb2plugins repos
  carry `host-compat-probe.mjs`, in five versions. Only the graph plugin
  carries `hostShim.mjs`, which fails the build on a name the host doesn't
  serve and stubs a runtime miss with a throw naming it. The plugin templates
  carry neither script.

## Next

1. **A conformance kit an external display can run.** Publish the display
   lint rules as a shareable config and the contract gate as a jest setup
   file, served nowhere at runtime (the generator skips them as it skips
   `shaders/*`). Then a test helper that mounts a display in a real linear
   genome view, which means publishing the parts of `display-test-utils` that
   do that.
2. **The graph display mounts `DisplayChrome`.** `LinearGraphDisplay` passes
   `createGraphRenderer` as the chrome's `factory`, and `GraphCanvas` takes
   the chrome's `CanvasHandle` when a track hosts it, calling
   `useRenderingBackend` only when standalone. `GraphStatusChrome` and its
   overlay imports go. The model's `displayPhase` gains `renderError`, and
   `painted` must cover `geometryPainted`.
3. **Move `hostShim.mjs`, `fetch-host-names.mjs` and one
   `host-compat-probe.mjs` into the plugin templates** (or a published build
   helper), and point the jb2plugins copies at it. That gives every
   plugin the graph plugin's name check in place of a load-time version gate.
