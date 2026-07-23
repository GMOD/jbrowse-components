---
status: Accepted
summary: "Delete the stranded pluggable glyph registry; glyph extensibility reopens worker-side or not at all"
---

# ADR-036: Delete the stranded pluggable glyph registry

## Status

Accepted (2026-07). Related to
[ADR-030](adr-030-render-core-package-static-import-only.md) (what the plugin
API surface is and isn't) and `reference/PLUGIN_ABI_STABILITY.md` (why stranded
surfaces ossify).

## Context

`PluginManager` carried a `glyphTypes` registry —
`addGlyphType` / `getGlyphType` / `getGlyphTypes`, a `GlyphType` pluggable
element class, `'glyph'` in `PluggableElementTypeGroup`, and `'glyph'` as the
**first phase** of `elementCreationSchedule`. Nothing in the tree called any of
it. Zero registrations, zero reads.

This was not accidental cruft. It was built deliberately in `ec0dd8920a`
("Create pluggable glyph system for canvas feature renderer", #5311), extended
in `a5ed10f7d2` (#5365), and shipped with a 355-line README
(`plugins/canvas/src/CanvasFeatureRenderer/glyphs/README.md`) documenting how to
write custom glyphs. It had a real consumer:

```ts
export function findPluggableGlyph(feature, pluginManager?) {
  const glyphTypes = pluginManager.getGlyphTypes()
  const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
  return sortedGlyphs.find(glyph => glyph.match?.(feature))
}
```

Pluggable glyphs matched by `priority` and took precedence over builtins.

`203a3a3c77` ("Updates", 2026-02) — part of the GPU rearchitecture — deleted
`CanvasFeatureRenderer/glyphs/` wholesale (README, consumer, builtin glyphs) and
replaced it with `RenderFeatureDataRPC/glyphs/`. The `PluginManager` registry was
left standing with its consumer gone.

Two things made this invisible in-tree and costly out-of-tree:

- **It still type-checked.** `addGlyphType()` succeeded and returned normally;
  the registration simply went nowhere. From outside, a silently-no-op API is
  indistinguishable from a working one.
- **The name collides with a live, unrelated type.** `plugins/canvas`'s
  `RenderFeatureDataRPC/types.ts` exports its *own* `GlyphType` — a closed string
  union (`'Box' | 'ProcessedTranscript' | …`) closed by a `never` exhaustiveness
  check in `glyphEmitters.ts`. Grepping for `GlyphType` finds live hits, so the
  dead registry reads as live.

It surfaced because an external plugin (VEuPathDB's `jbrowse-plugin-diamond-glyph`)
registered a glyph against the documented #5311 API, diffed `GlyphType.ts` across
the rearchitecture, found it byte-identical, and concluded it was unaffected. It
was byte-identical because it was dead on both sides.

## Decision

**Delete the registry.** Removed: `GlyphType.ts`; the import, `glyphTypes`
TypeRecord, `'glyph'` element-type group, `'glyph'` creation phase, `case 'glyph'`
dispatch, and the three accessors in `PluginManager.ts`; the import, union member,
and re-export in `pluggableElementTypes/index.ts`.

`plugins/canvas`'s own `GlyphType` union is **untouched** — it is the live one.

### Why not reconnect it instead

The interface is `draw(ctx: CanvasRenderingContext2D, …)` — a per-feature
main-thread callback. Glyph layout now runs in the **worker**
(`RenderFeatureDataRPC`), which emits geometry arrays across the RPC boundary. A
function cannot be `postMessage`d. Restoring the registry as designed would mean
dragging per-feature drawing back onto the main thread, re-ossifying the exact
shape the architecture moved away from — the "maintained forever" trap
`PLUGIN_ABI_STABILITY.md` describes.

Deleting is also strictly better *for the affected plugin*. Today
`addGlyphType` succeeds and silently renders nothing. After deletion, the
plugin's `install()` throws `TypeError: pluginManager.addGlyphType is not a
function`; `addPlugin` doesn't wrap `plugin.install()`, so it propagates to
`SessionLoader.buildPluginManager`, which catches it, logs it, and sets
`pluginManagerError` — rendering a `LoaderErrorBanner` instead of the app. The
app doesn't crash, but it does refuse to load, and the error names the missing
method. A failed load pointing at `addGlyphType` beats a working app that
quietly ignores the plugin.

### What deleting does not decide

This removes a decoy, not an option. Glyph extensibility remains open, and a
worker-compatible shape exists if we want it: `rpcWorker.ts` calls
`initializeWorker(corePlugins, { fetchESM })`, so **plugins do load in the RPC
worker**. A registry shaped as `match(feature)` + `emit(layout, collector)` —
emitting geometry rather than drawing to a ctx — fits the current boundary and
mirrors what `glyphEmitters.ts` already does internally. That is a separate
decision, to be made on its own merits rather than to unbreak one consumer. For a
single external glyph, taking the shape in-tree as a union member is likely
cheaper than designing a registration API for one caller.

## Consequences

- Any plugin calling `addGlyphType` now fails the whole app load with an error
  banner naming the method, instead of silently rendering nothing. This is
  intended. Note the blast radius: plugin `install()` errors are not isolated,
  so one stale plugin takes down the load rather than degrading. That is a
  pre-existing property of `addPlugin`, not something this ADR introduces.
- There is currently **no supported way for a plugin to add a glyph**. That is
  now explicit rather than implied by a dead API.
- `GlyphType` was never a subpath in `packages/core`'s `exports` map; it leaked
  only via the `./pluggableElementTypes` index barrel. `pnpm generate:exports` is
  a no-op after this change. Worth noting for the general question of what the
  barrel exposes that the subpath list doesn't — the barrel is a wider public
  surface than it looks.
- Future "there used to be a pluggable glyph system, why was it removed" lands
  here rather than being reverse-engineered from `203a3a3c77`, a large squashed
  commit titled "Updates".
- Follow-up: the same commit may have stranded other registries the same way.
  This one only surfaced because an external user tripped on it; an audit for
  registered-but-never-read pluggable types would be cheap and is not done here.
