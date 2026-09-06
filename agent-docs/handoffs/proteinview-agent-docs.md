---
name: proteinview-agent-docs
description: ProteinView (jbrowse-plugin-protein3d) is still missing from the bundled `docs` corpus the desktop MCP server serves — the external-plugin path through the doc generator is half-wired and `pnpm gendocs` fails on an in-tree hygiene assertion; the plugin's model tag is `Protein3dViewPlugin`, so `model:ProteinView` will miss even once it is in. Left from the protein filmed take, 2026-09-02.
---

# ProteinView in the agent docs

The protein take (`scripts/agent-demos/takes/protein.md`) lost most of a turn
because `docs topic:"model:ProteinView"` and `docs topic:"types"` had nothing:
`website/scripts/api-docs/util.ts getAllFiles` is `git ls-files`, so the doc
program only ever saw this repo's source, and the plugin is published from its
own repository.

## In the tree

- `jbrowse-plugin-protein3d@0.9.0` is a root devDependency whose runtime
  dependencies are dropped with `-` overrides in `pnpm-workspace.yaml` (20 MB,
  no molstar).
- `EXTERNAL_PLUGIN_PACKAGES` in `website/scripts/api-docs/util.ts` feeds its
  `src/` into the program; `pluginOf` in `agentText.ts` labels it; two of the
  generator's in-tree hygiene assertions are exempted for `isExternalSource`
  files.

## Not done

- `pnpm gendocs` still fails on a third assertion
  (`website/scripts/api-docs/generateConfigDocs.ts`, blank Description cells
  for the three adapters' `location` slot). More may follow: the coverage-gaps
  lists, the `#example` gaps, `writeSpecKeyDocs`. Exempt each for
  `isExternalSource` the same way, then check
  `website/docs/models/Protein3dViewPlugin.md` and
  `products/jbrowse-desktop/electron/mcp/docs/typeDocs.generated.json`.
- The plugin's tag is `#stateModel Protein3dViewPlugin`
  (`src/ProteinView/model.ts`), not `ProteinView`, so `model:ProteinView` misses
  until the plugin renames the tag or `lookupTypeDoc`
  (`products/jbrowse-desktop/electron/mcp/typeDocs.ts`) learns the composed MST
  name (`types.compose('ProteinView', ...)`).
- The session-spec page's explicit form for a ProteinView is not started: the
  launcher types its args inline on the `addToExtensionPoint` callback with no
  `declare module` augmentation and no `#launchKeys` tag, so `scanSpecKeys` in
  `generateSpecKeyDocs.ts` cannot see it.
- Placing a connected genome view and its structure in different layout cells
  from one spec entry needs the plugin to honour `id`, which it does not forward
  today.

Until this lands, the live-model guide's "An action's argument shape, when the
docs have no page for it" probe is how an agent learns the `addStructure` shape.

## Plugin-side, from the same take

- The view does not report readiness. `AppReadyMarker` reads `showLoading` and
  `initialized` off every open view (the contract is now in
  `website/docs/developer_guides/creating_view.md`); the plugin should expose
  `showLoading` as true until Molstar has drawn, so `jb.waitReady` and the
  capture tools wait for it instead of an agent guessing sleeps.
- `clickAlignmentPosition` toggles, so probing it mutates the selection. A
  non-toggling `setSelectedResidue(n)` / `clearSelection()` pair, and a
  `focusResidue(n)` that frames the camera with the highlight, would replace the
  eight-call sequence the protein take spent on one residue.
