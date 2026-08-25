---
status: Rejected
summary: "The region-too-large gate does not move to `@jbrowse/render-core`; ADR-030 bars the dependency and the gate's only composers are plugin-side, so the export surface was cut in place instead"
---

# ADR-045: The region-too-large gate stays in the LGV plugin

## Status

Rejected (2026-07). Closes the "move the gate out of the plugin" item from the
byte-gate simplification passes (that handoff is retired; the gate is documented
in [REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md)).

The location half is overtaken (2026-08): the gate moved to
`packages/display-kit` with the rest of the display foundation, and that package
exports it. The argument against `render-core` stands — the mixin still needs
`@jbrowse/core` — and display-kit is the package that may depend on it.

## Context

`RegionTooLargeMixin` + `regionTooLargeUtils` + `AUTO_FORCE_LOAD_BP` read as
display-foundation code that happens to live in a plugin:
`plugins/linear-genome-view/src/shared/`. Five other plugins gate on the verdict
(canvas, alignments, variants/LD, maf, arc), and `packages/render-core` already
owns the neighbouring foundation pieces — `RenderLifecycleMixin`, `displayPhase`,
`renderBlock`. Moving the gate there was the top open item, on two claims: that
foundation code shouldn't sit in a plugin, and that dropping the names from
`@jbrowse/plugin-linear-genome-view` is an ABI reduction
([PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md)).

Both claims dissolve on inspection.

**render-core cannot host it.**
[ADR-030](adr-030-render-core-package-static-import-only.md) makes render-core a
leaf that depends only on `mobx` + `@jbrowse/mobx-state-tree` — **never on
`@jbrowse/core`** — and the mixin needs `getConf`, `readConfObject`, `getSession`,
`getContainingTrack`, `getContainingView` and `getRpcSessionId` from exactly
there. Duck-typing the view (the invariant the move was going to lean on) fixes
only one of those six. ADR-030 also names the other side of the line explicitly:
`MultiRegionDisplayMixin`, `GlobalDataDisplayMixin` and `DisplayChrome` "stay in
the LGV plugin (not primitives — they depend on view/display models)." The gate
is the same shape of thing.

**Moving the leaf decouples nothing.** The five plugins don't import the mixin;
they compose `MultiRegionDisplayMixin` or `GlobalFetchMixin`, which bring it —
and both of those are pinned plugin-side by ADR-030. A foundation package would
end up owning a piece whose only two composers still live in the plugin, so not
one consumer stops depending on the plugin. `packages/core` could host it
(`HighlightsMixin` is precedent), but that trades a plugin export for a core one
and splits the gate from its composers for the same zero coupling win.

## Decision

**The gate stays in `plugins/linear-genome-view/src/shared/`. The export-surface
reduction the move was really after is done directly.**

- `RegionTooLargeMixin` and the seven verdict internals (`resolveByteLimit`,
  `evaluateRegionTooLarge`, `rescaleByteEstimateToVisibleSpan`,
  `bytesTooLargeReason`, `TOO_MANY_FEATURES_REASON`, `getDisplayStr`,
  `RegionTooLargeStatus`) are plugin-internal — no consumer outside the plugin
  ever existed.
- `AUTO_FORCE_LOAD_BP` moved from `LinearGenomeView/model.ts` (which never read
  it) into `regionTooLargeUtils.ts`, and left the export surface too. Its one
  out-of-plugin reader was MAF's `showSummary`, which now reads the new
  `aboveForceLoadFloor` getter — the mixin's single comparison against the floor.
  That is a strict improvement over the move: the floor was applied in four
  places that had to agree by hand, and MAF's copy was one of them.
- `aboveForceLoadFloor` deliberately excludes the opt-in and force-load terms
  (`gateActive` adds those on top), because MAF's `showSummary` is itself a
  function of the floor and gate getters then read *it* — a floor getter that
  read the opt-in would close the loop. (The reader was `measuresBytesPreFlight` when
  this was written and is `byteGateAdapterConfig` now; the shape is the point.)

## Consequences

- The gate's placement question is settled; re-propose only if the mixin's
  dependency on `@jbrowse/core` goes away, which would mean the config reads and
  the RPC call left it — i.e. a different mixin.
- The ABI win landed without a cross-package move, so no
  `pnpm gen-tsconfig-refs` run, no import churn in five plugins, and no
  re-export shim to defeat the point.
- General rule, same genre as
  [ADR-042](adr-042-no-shared-assembly-swap-autorun-installer.md): when the
  argument for relocating code is "it belongs in the foundation layer", check
  what the *consumers* actually import first. If they reach the code through
  something that stays put, the move buys the layering diagram and nothing else.
- The state-model member renames from these passes still owe a `pnpm autogen`
  commit on a clean tree (`agent-docs/TODO.md`).
