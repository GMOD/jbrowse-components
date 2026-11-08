---
name: verifying-claims
description: Is a red mine, does a green suite cover this, and where does a rename or removal sweep miss? The repo's checks behind "it landed", "it is tested" and "nothing uses it". Read before landing a stale branch, calling something uncovered, or deleting a name.
audience: internal
kind: operations
---

# Verifying claims

JBrowse ignores an undeclared config key, and a member lookup that stops
resolving throws nothing, so a missed home or an unpinned fix passes every fast
gate. This page lists where this repo's fast gates are blind. Test harnesses are
in [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md); plugin-facing names are in
[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md).

## Whose red is it

- **A rebased branch's scoped suites stay green; its repo-wide gates move.**
  After rebasing a stale branch, rerun the pre-push gates (`pnpm typecheck`,
  `lint:eslint`, `build:esm`, `autogen --check`, `gen:shaders`,
  `scripts/check-docs.ts`) and fold each fix into the commit that caused it. A
  branch merged from parallel slice agents also reddens suites no slice owns:
  jbrowse-web `schemaTests`, a `publicApi` snapshot, a CLI test.
- **After back-to-back landings**, scan `git diff --stat <base>..HEAD` for a doc
  emptied to zero lines and for a reused ADR number.
- **A failed CI step hides the steps after it, and `needs:` jobs show
  `skipped`.** In `.github/workflows/push.yml`, "Build and pack artifacts" runs
  `check-declaration-leaks` before `check-extension-point-reachability`, and
  three jobs need its packed artifacts. Run the rest of the job's `steps:`
  locally after a fix; read `gh run view --json jobs` for skipped jobs.
- **A red the change does not touch:** `git diff --name-only main...HEAD`
  against the files the failing check reads settles whose it is.

## Does a green suite cover it

- **The only end-to-end jsdom layer is `products/jbrowse-web/src/tests`**, and
  `pnpm test` leaves it to CI. Unit suites mock the seam under test: a sabotage
  of `CoreGetRefNames` sequence priming stayed green across 6,607 core and
  plugin tests and reddened `SaveTrackData.test.tsx`. Before calling a mechanism
  uncovered, grep jbrowse-web tests and `browser-tests/` for the call
  (`await executeX(`), not the import, and run that suite with the sabotage.
- **A jbrowse-web red on a security tightening means a case was removed.**
  `Authentication.test.tsx` pins an explicit `internetAccountId` on a relative
  uri, the shape a config with relative data paths needs.
- **A package guard test is no file's "changed suite".**
  `packages/display-ui/src/muiFree.test.ts` and
  `packages/core/src/util/tss-react/muiFree.test.ts` refuse a `@jbrowse/core/ui`
  barrel import in a new module. After adding a module, run its package's whole
  `src` with jest.
- **`session.getTrackById` resolves from several stores**: the track list,
  `sessionTracks`, each assembly's and temporary assembly's `sequence`, a
  connection's `tracks` and persisted connection-track configs, plus inline
  display configs (ADR-084). A change to config reads or writes gets a probe
  writing through each, asserting the read-back and where it was saved. A
  display snapshot without `configuration: '<trackId>-<DisplayType>'` gets an
  inline config, so the probe passes on both arms.
- **A hand-built hub fixture holds only the types its author expected.** The
  hosted `https://jbrowse.org/ucsc/hg38/config.json` carries two-assembly
  `SyntenyTrack`s that an embedded LGV registers no type for. A change to how a
  hub config or catalog resolves gets a browser check against the hosted hub
  through the rebuilt bundle, and the fixture gets one entry of an unregistered
  type.
- **A grow-only ratchet stays green after an improvement.** Run the `check-*` or
  `audit-*` script before and after, and lower the baseline; take the number
  from the script, not from a handoff. `audit-config-read-types.ts --write` also
  rewrites `agent-docs/measurements/config-read-*.json`, which docs embed.
- **A mirror test spells the constant it copies.** After unifying one, grep for
  the old literal, and make the survivor importable (`//! export-consts` for a
  shader constant, ADR-051).

## Where a rename or removal sweep misses

Typecheck, `test-related` and `verify` see none of these homes.

- **Configs and generators.** `git grep -l '\b<old>\b'` over the whole tree,
  excluding `*.generated.*`, `website/docs/config`, `website/docs/models` and
  changelogs, reaches `demos/*/config.json`, `test_data/*/config.json`, tutorial
  fences, `website/scripts/specs/*.ts` and `scripts/build_*.sh`. Then
  `pnpm autogen`, `website/scripts/audit-figures.ts`,
  `website/scripts/check-spec-recipes.ts`, and `ConfigSlotDefaults.test.ts -u`.
- **`website/src`.** `website/src/lib/spec-recipe/fields.ts` imports plugin menu
  constants by relative path, outside the workspace typecheck, and spells menu
  paths; only `pnpm autogen` fails on it.
- **The four `products/*/examples-site` trees** and
  `products/jbrowse-img/README.md` prose.
- **A retired enum value**, not just a key: `jbrowse validate` errors on it
  until it is in `LEGACY_VALUE_CANDIDATES`
  (`scripts/generateConfigManifest.ts`).
- **A retired-spelling lift rescues every writer the sweep missed.** Once the
  sweep is clean, make the lift `throw new Error('LIFTED_<name> ' + …)`, run the
  touched packages' suites, fix every writer the trace names, and confirm the
  lift's own tests fail under the trap. Build the old key at runtime in those
  tests (`{ [BETA]: … }`) so a regex sweep leaves them alone.
- **jbrowse-web tests, `products/jbrowse-web/browser-tests` and
  `website/scripts`** read model getters through hand-written interfaces, so
  typecheck misses them. Grep them, test files included, before deleting a
  member as unread, and after changing a menu label or tick rule.
- **A screenshot spec reaching a config through a shared const**
  (`GRASSES_RICE_LANES` in `specs/synteny.ts`): import `specs` from
  `screenshot-specs.ts` and match `decodeURIComponent(JSON.stringify(s))`.
- **A menu label with two real spellings.** `HamburgerMenu.tsx` renders
  `Add track...` and `HierarchicalFab.tsx` a bare `Add track`.
  `check-menu-labels.ts` judges only `**A → B**` paths, so grep the bare form
  across `plugins/ packages/ products/` before "fixing" a lone bold label.
- **Emitted `.d.ts` for barrel exports.** A type nobody imports can be what tsc
  serializes into another package's declarations, and
  `scripts/check-declaration-leaks.ts` fails when it goes. After `build:esm`,
  harvest `import("@jbrowse/plugin-…").X` from `plugins/*/esm packages/*/esm`.
- **Slot reads a string grep misses**: destructured off a config, read only by
  its own `preProcessSnapshot`, or only in `.tsx`.
- **Outside this tree**: `~/src/Apollo3` and the published plugin bundles
  ([PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md)). Minification keeps
  property names, so `grep -o ".\{160\}name.\{160\}"` on a fetched bundle reads
  the call in context. `pluginFacingSessionApi.test.ts` should perform a kept
  call and assert its destination, since a name can survive while its meaning
  moves.

## Audit negatives this repo's greps get wrong

- **An `rpcManager.call` without `statusCallback`** usually forwards it in a
  `...opts` spread; `noUnreportedRpcCall` accepts a spread, so follow it to its
  type. Same for `stopToken`.
- **A tutorial download spelled `$BASE/name.sh`**: expand page variables or grep
  bare filenames.
- **A check armed by a counter a subclass can drop**: write the producer sweep
  as the test (`packages/display-kit/src/reloadReachesCounter.test.ts`).
- **"Not declined before"**: grep the exact spelling across the ADRs,
  Consequences sections included.
- **An unreferenced `scripts/build_*.sh` is as likely a failed run as an unshot
  asset.** Its header records the failure (`WARNING`, `NEGATIVE RESULT`), and
  `git log --oneline --follow` showing one commit is the tell.

## Tooling "can't" claims

- **"Unverifiable here" for WebGPU:**
  `products/jbrowse-web/browser-tests/runner.ts` runs `--backend=webgpu` on
  Firefox Nightly. `--backend=all --gate-only` is the cheapest GPU oracle, and a
  webgpu snapshot failure is usually a stale golden.
- **"The shader emitter lacks X":** grep `MATH_BUILTINS` and `HELPER_BUILTINS`
  in `packages/shader-tools/src/shader-codegen/wgslToJs.ts` and
  [SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md) before believing it;
  `check-oracle` drops a refused candidate silently
  ([SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md)).
