# Protein3d side-by-side launch — handoff

## Goal (from reviewer)

The `protein/structure` and `protein/connected` doc figures should show the
**linear-genome-view ↔ protein-structure connection side by side** (left genome
| right protein), not a stacked or standalone structure. The user wants the
connected launch to **default to a side split**, controllable by a **small
self-contained setting inside the launch dialog** (NOT the global preferences
dialog).

## What's DONE

### Plugin: `~/src/jb2plugins/jbrowse-plugin-protein3d` — published as **v0.4.13**

Committed (`2d93ee9`) and published via `pnpm version patch` (tag `v0.4.13`
pushed → CI npm publish + jbrowse.org `latest/` rehost). Lint ✓, build ✓,
98 unit tests ✓, `tsc` ✓.

- **`src/LaunchProteinView/utils/sideBySide.ts`** (new) — self-contained
  localStorage preference (`proteinView-launchSideBySide`, **default true**),
  the `launchViewSideBySide(session, viewId)` helper, and an
  `isSessionWithWorkspaces` type guard.
- **`launch3DProteinView`** (launchViewUtils.ts) and the
  **`LaunchProteinViewExtensionPoint`** now accept an explicit `sideBySide`
  override (used by declarative session specs); otherwise they fall back to the
  preference. After `addView('ProteinView', …)` they call
  `launchViewSideBySide`.
- **`src/LaunchProteinView/components/LaunchSettingsDialog.tsx`** (new) — a small
  gear-icon ("Launch settings") dialog in `ProteinViewActions.tsx` toggling the
  side-by-side preference. Intentionally NOT wired into the core
  `Core-preferencesDialogPanels` extension point (user: "we dont want it in
  global preferences").

The split mechanism mirrors the proven `ViewMenu` "Move to split view" action:
```ts
session.setPendingMove({ type: 'splitRight', viewId })
session.setUseWorkspaces(true)
```
(`packages/app-core/src/ui/App/ViewMenu.tsx`,
`packages/app-core/src/ui/App/TiledViewsContainer.tsx` `createInitialPanels`).

### jbrowse-components: screenshot specs (`website/scripts/screenshot-specs.ts`)

Both `protein/structure` (BRAF P15056 / NM_004333.6) and `protein/connected`
(TP53 P04637 / NM_000546.6) are connected `sideBySide: true` launches rendered
against the **local build** via a bare `?config=${PROTEIN3D_CONFIG}` url
(`test_data/protein3d_config.json`), which loads protein3d from the jbrowse.org
plugin-store `latest/`. Both dropped `curated` and the old
`localhost:9000/.test-jbrowse-nightly` dev-server url — the local build has the
`setPendingMove({type:'splitRight'})` split API the side-by-side launch needs
(`packages/app-core/src/ui/App/ViewMenu.tsx`, exercised in
`DockviewLayout.test.ts`).

`PROTEIN3D_CONFIG` was re-added. Its ClinVar `LinearVariantDisplay` uses the
**modern** config (no `renderer` sub-config — that concept is gone from the
webgl-poc tree): a bare `color` jexl slot
(`jexl:({...CLNSIG→color map...})[feature.INFO.CLNSIG] || 'purple'`).

## The BUG / blocker (why the figures are still stacked)

Diagnostic (load connected spec, read `window.JBrowseSession`) against the
current published `main` nightly harness:

```
hasSetUseWorkspaces: true
hasSetPendingMove:   false      ← MISSING
useWorkspaces:       false      ← split never fires
views:               [LinearGenomeView, ProteinView]   (both created correctly)
```

The extension point **runs** (the connected LGV is created and wired — the
`test:docs` E2E confirms it), my code **is in the served bundle** (6 marker hits
in `dist/out.js`), and `launchViewSideBySide` **is called** — but its guard
requires **both** `setUseWorkspaces` *and* `setPendingMove`, and the nightly
session only has the former. So it correctly no-ops → layout stays stacked.

`setPendingMove` exists in the **local** tree
(`packages/app-core/src/DockviewLayout/index.ts:126`) but is **not in the
published `jbrowse.org/code/jb2/main` nightly** that
`jbrowse create --nightly` pulls (only `setUseWorkspaces` is). So the API the
split needs hasn't shipped to the nightly yet. (User noted 4.3.0 "had
workspaces" but "might have had bug" — i.e. an earlier/partial workspaces API
without `setPendingMove`.)

## Next steps for the next agent

1. **Verify the split against a build that HAS `setPendingMove`.** Either:
   - Build jbrowse-web from this local repo (`pnpm --filter @jbrowse/web build`)
     and serve `products/jbrowse-web/build` as the harness the protein3d
     `config.json` plugin-url + `?config=` point at, **or**
   - wait for a nightly where `setPendingMove` has merged to GMOD `main`, then
     `jbrowse create .test-jbrowse-nightly --nightly --force`.
   Then re-run the plugin's `pnpm test:docs` (auto-starts `pnpm start` on :9000)
   and check `test-screenshots/docs-connected.png` is now side-by-side. There's a
   minimal diagnostic pattern in this doc's history (reads `JBrowseSession`
   `.useWorkspaces`/`.pendingMove`) — re-create it if needed.

2. **If the split confirms,** regenerate the two doc figures: run the protein3d
   dev server with a config that has `hg38-ncbiRefSeq` (+ `clinvar_ncbi_hg38`)
   — the plugin's `config.json` already has these; `distconfig.json` only has
   gencode, which is why these specs are `curated`. Temporarily drop
   `curated: true` from the two specs and run
   `node --experimental-strip-types website/scripts/generate-screenshots.ts
   --filter protein/connected,protein/structure --force` against the local
   plugin build. Re-add `curated` after.

3. **Guard reconsideration:** if a target build genuinely lacks `setPendingMove`,
   the session-action-only split can't be expressed; the alternative is the
   React-context `moveViewToSplitRight` (DockviewContext), which a launch util
   can't reach. Keeping the both-methods guard (degrade to stacked) is the safe
   choice — don't loosen it to call `setUseWorkspaces` alone (that enables
   workspaces without performing the split, leaving views stacked in one panel).

4. **Default-on caveat:** `getLaunchSideBySide()` defaults **true**, so once the
   harness supports it, EVERY dialog-driven protein launch will enable
   workspaces + split. Confirm that's the desired default (user leaned "kind of
   want the launch to default to side split"); the gear-icon setting turns it
   off per-user.

## Files touched

Plugin (committed + published v0.4.13):
- `src/LaunchProteinView/utils/sideBySide.ts` (new)
- `src/LaunchProteinView/components/LaunchSettingsDialog.tsx` (new)
- `src/LaunchProteinView/utils/launchViewUtils.ts`
- `src/LaunchProteinViewExtensionPoint/index.ts`
- `src/LaunchProteinView/components/ProteinViewActions.tsx`

jbrowse-components (uncommitted working tree):
- `website/scripts/screenshot-specs.ts` (protein/connected + protein/structure)
