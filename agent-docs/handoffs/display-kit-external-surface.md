---
name: display-kit-external-surface
description: "What still fails silently for an external display built on @jbrowse/display-kit: a member-level contract no check outside the tree sees, a version pin that guards only types (a version gate at load is declined), chrome props with no check (the graph display now reads them), lint rules and a contract gate published as display-kit/conformance but not yet released or adopted, and host-compat tooling copied across eight plugin repos. Read before changing a mixin member a plugin display reads, adding a display-kit subpath, or touching a plugin template's build."
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
- **The tree's display checks are published, unreleased.** The display
  `no-restricted-syntax` selectors and the contract gate moved into
  `@jbrowse/display-kit/conformance/{lintRules,contractGate}`, which this
  tree's `eslint.config.mjs` and `config/jest/contractGate.js` import, and the
  ReExports generator skips `conformance/*` as it skips `shaders/*`. The gate
  takes the runner's `afterEach`/`afterAll`, since both plugin repos use
  vitest. Until a release publishes them, the graph plugin's
  `config/vitest/console.js` passes a contract report through and its suite
  stays green. `reloadReachesCounter.test.ts` still scans only this tree, and
  `@jbrowse/display-test-utils` is private.
- **A runtime plugin cannot pin display-kit, and a version gate is declined.**
  The host serves its own copy. ARG builds against `5.0.0-beta.4` and runs on
  beta.18 hosts, so a gate on version would warn on or refuse plugins that
  work. The check is by name instead; PLUGIN_ABI_STABILITY.md's §"The real
  cure" item 2 has the ruling.
- **Chrome props are unchecked ABI.** The graph display mounts
  `DisplayChrome` (graphgenomeviewer `6ad9c9e`, pushed, unreleased), so it reads
  `DisplayChrome`'s members off its model: `displayPhase`, `painted`,
  `renderError`, `regionTooLargeReason`, `zoomCanReleaseGate`, `forceLoad`,
  `reload`, `statusMessage` and `notices`. That makes it a second external
  consumer of the member-level contract above.
- **The host-compat tooling lives in the plugins.** Eight jb2plugins repos
  carry `host-compat-probe.mjs`, in five versions. The graph plugin's
  `hostShim.mjs`, which fails the build on a name the host doesn't serve and
  stubs a runtime miss with a throw naming it, is now
  `@jbrowse/core/ReExports/hostShim`. The plugin templates carry neither.

## Next

1. **A test helper that mounts a display in a real linear genome view**, the
   rest of the conformance kit: publish the parts of `display-test-utils`
   that do that, as a `conformance/*` subpath or a package of its own. Once a
   release carries `conformance/*`, the graph plugin installs the gate in its
   vitest setup and spreads `displayRestrictedSyntax` into its lint, and ARG
   follows; the display-kit README has both recipes. A dry run of the lint
   recipe on graphgenomeviewer `11a67c3` reports one `attachRenderingBackend`
   (`pane/renderingActions.ts`), four `rpcManager.call`s with no
   `statusCallback` (three in `pane/loadActions.ts`) and 26 non-observer
   components, most of them dialogs and the pieces in `PaneSvg.tsx`.
2. **Point the jb2plugins builds at `@jbrowse/core/ReExports/hostShim`** once
   a release publishes it (beta.18 does not). Core's copy reads the installed
   core's names, so the graph plugin drops `hostShim.mjs`,
   `fetch-host-names.mjs` and its saved host names, and its
   `host-names-check.mjs` calls `fetchHostNames`. Seventeen others still
   externalize through `globalExternals` and read undefined for a missing
   name. `plugins/blat`'s UMD build is the in-tree consumer.
3. **Update the plugin templates**, which still build against core 4.x with
   `globalExternals`, onto `hostShim`. A generic `host-compat-probe.mjs`
   (boot hosted releases, fail on a plugin load failure) can go in with them;
   each jb2plugins probe also draws its own tracks, which stays per plugin.
