# Handoff: "Identifier types can only be instantiated as direct child of a model type"

## Error

When toggling a track on in jbrowse-web, the browser console shows:

```
Uncaught Error: [mobx-state-tree] Identifier types can only be instantiated as direct child of a model type
    MobX 30
    showTrackGeneric webpack://.../packages/core/src/util/tracks.ts?:413
    toggleTrackGeneric webpack://.../packages/core/src/util/tracks.ts?:438
    toggleTrack webpack://.../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:914
```

## What the error means

`BaseIdentifierType.instantiate` in MST throws this when
`parent.type instanceof ModelType` is false:

```javascript
// node_modules/@jbrowse/mobx-state-tree/.../mobx-state-tree.mjs
instantiate(parent, subpath, environment, initialValue) {
    if (!parent || !(parent.type instanceof ModelType)) {
        throw fail(`Identifier types can only be instantiated as direct child of a model type`);
    }
    ...
}
```

That means a `types.identifier` field is being instantiated inside something
that is NOT a `types.model` (e.g. directly in an array, map, union, or
snapshot processor).

## First step: verify if MST downgrade fixes it

The MST version was recently bumped from `^5.8.7` to `^5.9.3` (via multiple
steps). Before deep-diving further, verify causality:

1. In `packages/core/package.json` (and every other package that depends on
   `@jbrowse/mobx-state-tree`), temporarily pin to `^5.8.7`.
2. Run `pnpm install`.
3. Restart the dev server and try toggling a track.
4. If the error disappears on 5.8.7 → the MST bump is the cause.
   If not → the cause is in our own code.

Key MST changes between 5.8.7 and 5.9.0 (the most significant bump):
- `ModelType.willChange`: added `change.type !== "remove"` guard around
  `typecheckInternal(childType, change.newValue)` and `reconcile(...)`.
  Before 5.9.0, a "remove" change would still run typecheck/reconcile.
- `ModelType.didChange`: added `change.type !== "remove"` guard around
  `emitPatch`.

These are the most likely candidates if MST is the culprit.

Note: 5.9.2→5.9.3 only changed `noMatchMessage`/`_findCandidateByTypeDiscriminator`
(error message improvements only). Definitely NOT the cause.

## Code paths to investigate if downgrade doesn't help

The error fires inside `showTrackGeneric`. The most important call is:

```typescript
// packages/core/src/util/tracks.ts:557
const track = trackType.stateModel.create({
    ...initialSnapshot,
    type: conf.type,
    configuration: inlineConf ?? trackId,
    displays: [{
        type: displayType,
        configuration: displayId,
        ...displayConfState,
        ...displayInitialSnapshot,
    }],
})
```

The identifier could be failing in several sub-trees created here:

### Candidate 1: display config schema hydration via DisplayConfigurationReference

When `display.configuration` is first accessed (after track is pushed into
`self.tracks`), `DisplayConfigurationReference.get` is called. This accesses
`track.configuration.displays`, which triggers `TrackConfigurationReference.get`,
which calls `schemaType.create(frozenTrackConfig, getEnv(parent))` to hydrate
the frozen config.

Inside that create, `displays: types.array(pluggableConfigSchemaType('display'))`
processes the display configs. Each display config schema has
`displayId: types.identifier` (required, non-optional). If the union dispatch
selects the wrong display config schema (or if `determineType` fails), an
identifier could end up in the wrong place.

**To debug:** Add `console.log('creating track config', ret)` before the
`schemaType.create(ret, getEnv(parent))` call in `TrackConfigurationReference.get`
(configurationSchema.ts:338).

### Candidate 2: wrong type selected in pluggableConfigSchemaType union

`pluggableConfigSchemaType('display')` = `types.union(...allDisplayConfigSchemas)`.
None of these have `explicitlyTyped: true`, so they don't have a `type` literal
discriminant. In the `types.find(type => type.is(value))` slow path, the FIRST
config schema whose validation passes is selected. If that's the wrong schema,
instantiation may fail.

**To debug:** Check if all display config schemas have a reliable discriminant.
Consider adding `explicitlyTyped: true` to display config schemas so
`snapshotLooksLikeType` can use the `type` literal to dispatch correctly.

### Candidate 3: inlineConf with a schema that has a required identifier

If `inlineConf` is passed as an object (non-toggle path), `configuration: inlineConf`
routes through the `schemaType` branch of `TrackConfigurationReference`. If the
inlineConf snapshot has a `trackId` field, `types.identifier.instantiate` is
called with the parent being the parent of the `configuration` field in the track
state model — which is the track state model's ObjectNode (ModelType ✓). So this
should be fine for normal cases.

**BUT**: if `inlineConf` is missing `trackId` (no identifier value), the
schema's `preProcessSnapshot` might fail or produce a snapshot that causes a
problem downstream.

## Recent code changes that could be responsible

All on `webgl-poc` branch, all May 27-28 2026:

| Commit | Description | Suspicion |
|--------|-------------|-----------|
| `956a1ae4dd` | Added `inlineConf` param to `showTrackGeneric`; changed `configuration: inlineConf ?? trackId` | Low for normal toggle (inlineConf=undefined); could matter for callers passing inlineConf |
| `00041d291f` | Config schema: removed volatile constants, precomputed `subSchemaKeys`, simplified DisplayConfigurationReference | Medium: `subSchemaKeys` could mismatch if a key appears in snapshot but not modelDefinition |
| `27f2094a4b` | Dropped auto-create-detached fallback in DisplayConfigurationReference | Low: causes a throw if display not found, not an identifier error |
| `661927c869` | MST bump from 5.8.7 → 5.9.0 | Medium: `willChange`/`didChange` behavior changed |
| `dfc0793108` | MST bump from 5.9.2 → 5.9.3 | Very low: only error message changes |

## Debugging strategy

1. **Downgrade MST first** (fastest to check).

2. If MST is not the cause, add a try/catch around `trackType.stateModel.create(...)`:
   ```typescript
   try {
       const track = trackType.stateModel.create({...})
   } catch (e) {
       console.error('create failed', e)
       // add a debugger statement here and inspect the snapshot
       debugger
   }
   ```

3. Enable MST type checking in dev mode (it may already be on) so MST
   validates snapshots before creating nodes — this often gives a clearer
   error message earlier in the process.

4. Check `pluggableConfigSchemaType('display')` union dispatch: add logging
   inside `TrackConfigurationReference.get` and inside each display config
   schema's `preProcessSnapshot` to see which schema is selected for which
   display type.

## Files to focus on

- `packages/core/src/util/tracks.ts` — `showTrackGeneric` (line 489)
- `packages/core/src/configuration/configurationSchema.ts` — `TrackConfigurationReference`, `DisplayConfigurationReference`
- `packages/core/src/pluggableElementTypes/models/baseTrackConfig.ts` — `displays: types.array(pluggableConfigSchemaType('display'))`
- `packages/core/src/PluginManager.ts:441` — `pluggableMstType` and `pluggableConfigSchemaType`
