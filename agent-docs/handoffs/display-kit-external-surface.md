---
name: display-kit-external-surface
description: "What still fails silently for an external display built on @jbrowse/display-kit: a member-level contract pinned only by a hand-measured test, a version pin that guards only types (a version gate at load is declined), chrome props with no check (the graph display now reads them), lint rules, a contract gate and a display harness published as display-kit/conformance but not yet released or adopted, and host-compat tooling copied across eight plugin repos. Read before changing a mixin member a plugin display reads, adding a display-kit subpath, or touching a plugin template's build."
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
- **The external checks see names; the members are pinned by hand.**
  `publishedPluginReads.json` records `module#name`, so
  `displayKitTests/externalDisplayReads.test.ts` lists the foundation members
  the ARG and graph displays read (measured 2026-10-30 by intersecting their
  source's property accesses with the composed foundation's `getMembers`)
  and the exact required keys of `ChromeModel`, which the host's chrome reads
  off a plugin's model. A sabotage of each turned typecheck red. A read added
  in a plugin later is not covered; deriving the list from the store bundles
  would need each minified `.name` access tied to the object it reads.
- **The tree's display checks ship in beta.19, and two plugins run them.**
  The display `no-restricted-syntax` selectors, the contract gate and the
  display harness live in `@jbrowse/display-kit/conformance/*`, which this
  tree's `eslint.config.mjs`, `config/jest/contractGate.js` and
  `@jbrowse/display-test-utils` consume and the ReExports generator does not
  serve. Graphgenomeviewer (`a53a684`..`2b30988`) and jbrowse-plugin-arg
  (`1541f21`..`3344290`) build against beta.19, install the gate in vitest
  and lint with the rules; both are committed, unpushed and unreleased. The
  gate found no violations in either. The graph plugin had nine
  `console.error` mocks that took the rest of its display suite out of the
  gate, and they went. ARG has no test that mounts its display, so the gate
  has nothing there to watch yet. `reloadReachesCounter.test.ts` still scans
  only this tree.
- **The harness models one display on one stub track.**
  Graphgenomeviewer's `LinearGraphDisplay.test.ts` stays hand-built. It needs
  the plugin's own track and real adapter types, several track configs
  across four track types, assembly aliases, a second view, a session that
  records `addView`/`notifyError` and exposes `views`, `tracks` and
  `hovered`, and tracks shown through `view.showTrack`.
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
  carry `host-compat-probe.mjs`, in five versions. Graphgenomeviewer and ARG
  now build through `@jbrowse/core/ReExports/hostShim`, floored at beta.18
  by a check against `fetchHostNames('v5.0.0-beta.18')` (graph:
  `host-names-check.mjs` over its `hostReleases.mjs` list; ARG:
  `check-umd-floor.mjs`). Ten of the remaining 16 plugins, and both
  templates, build against v4 core for v4.3.0 hosts, and `hostShim` needs a
  v5 core installed, so they wait for 5.0.0 stable. The other six (msaview,
  tandem-repeat, protein3d and its three variants) are on beta.9 with
  `globalExternals`.
- **BLAT's hosted `v1` bundle held at its beta.18 build on the beta.19 tag.**
  `check-umd-floor.ts` refused it because `useUcscQuery.ts` imports
  `@jbrowse/core/util/electron` (`dd04d93054`), which beta.18 does not serve.
  Nothing a web user sees changed in BLAT since then, and at the next tag the
  floor is beta.19, so `v1` updates then, without a `v2`.

## Next

1. **Push and release graphgenomeviewer and ARG** with their beta.19
   adoption commits, after a look at graph's `fcd0a3d`. That commit feeds
   `GetSubgraph`'s refName-index download to the pane's status line, and
   nobody has watched it in the app.
2. **Move the six beta.9 plugins onto beta.19 and `hostShim`** (msaview,
   tandem-repeat, protein3d ×4), the way ARG went: bump, swap
   `globalExternals` for `hostShim`, floor-check against beta.18, install the
   gate and lint. Mind protein3d's and msaview's figure release gates.
3. **At 5.0.0 stable,** move the v4 plugins and both templates onto
   `hostShim`, with a generic `host-compat-probe.mjs` in the templates.
4. **Grow the harness** toward graph's needs (above) only if a second plugin
   suite wants the same shape.
