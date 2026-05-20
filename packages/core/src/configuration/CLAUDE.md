# Configuration package

## `getConf` vs `readConfObject`

Two reader functions, intentionally distinct:

- `getConf(model, path)` — when you hold a model that *has* a `.configuration`
  member (a track state model, display state model, etc.). Internally:
  `readConfObject(model.configuration, path)`.
- `readConfObject(config, path)` — when you hold the configuration model
  directly (e.g. an entry from `session.tracks`, which is
  `AnyConfigurationModel[]`).

A TS error "Property 'configuration' is missing" means you have the raw config
and should be calling `readConfObject`. Don't loosen `getConf` to accept both
shapes — the type error is the signal.

## Frozen tracks + hydration + `ConfigurationReference`

The biggest piece of subtlety. Read this before changing any of:
`TrackConfigurationReference`, `DisplayConfigurationReference`,
`ConfigurationReference` dispatch, or the hydration cache in
`product-core/src/Session/Tracks.ts`.

### Why frozen

`jbrowse.tracks` is stored as `types.frozen` (plain JS objects). With many
tracks (10k+) the MST overhead of holding every track as an MST instance is
prohibitive; freezing keeps load fast and memory small.

### Hydration

Track configs only become MST nodes lazily, through `session.tracksById`
(`TracksManagerSessionMixin`). The hydration cache is a `WeakMap<frozenObj,
MstNode>`, so:

- The same frozen object always maps to the same MST node (identity-stable
  across reads).
- When `updateTrackConf` replaces the frozen entry, the WeakMap entry is
  dropped naturally, and the next read produces a *new* MST instance.
- Unchanged sibling tracks keep their identity because their frozen reference
  is unchanged.

### Reference resolution

Track and display state models hold their config via `ConfigurationReference`.
Dispatch lives in `configurationSchema.ts:ConfigurationReference`:

| Signal on schema                            | Branch                          |
|---------------------------------------------|---------------------------------|
| `explicitIdentifier: 'trackId'`             | `TrackConfigurationReference`   |
| `explicitIdentifier: 'displayId'`           | `DisplayConfigurationReference` |
| schema name ends `DisplayConfigurationSchema` | `DisplayConfigurationReference` |
| anything else                               | plain `types.union(ref, schema)`|

Two signals for displays because most display schemas don't declare
`displayId` themselves — it's auto-injected by
`baseTrackConfig.preProcessSnapshot` as `${trackId}-${displayType}` when the
track config loads. The name-suffix fallback catches schemas that rely on
that auto-injection.

### `TrackConfigurationReference` quirks

- Looks up via `session.tracksById[id]` first; falls back to
  `resolveIdentifier`. The fallback path is likely dead after the frozen
  refactor (every track is in tracksById) but is kept as a backstop. Has a
  `@ts-expect-error` because `IAnyType` doesn't carry the identifier shape.
- Wraps the union with `types.snapshotProcessor` so output is always the
  trackId string. Input accepts string OR full object (dispatcher in the
  union).

### `DisplayConfigurationReference` quirks

- Looks up via `track.configuration.displays.find(d => d.displayId === id)`.
  Linear scan; would benefit from a `displaysById` MobX view on the track
  config but not done yet.
- Falls back to type-match (`d.type === parent.type`) — handles state models
  whose display type wasn't in the saved config.
- Last-ditch fallback creates a detached config via `schemaType.create(...)`.
  **CAVEAT:** this is an orphaned MST node — edits via the editor widget will
  not persist because there's no path from the saved snapshot back to it.
  Acceptable for ephemeral defaults; if persistence matters, the config must
  be appended to `track.configuration.displays` via an action.
- Does NOT use `snapshotProcessor` — the JSDoc on the function explains
  this triggers "setConfig is not a function" errors on sub-displays.
  Asymmetric with track refs by design; the root-cause `setConfig` call is
  not yet identified.

## Testing the reference layer

Unit tests in `configurationSchema.test.ts` exercise all three flavors with
minimal MST shims (no full session boot needed). Integration tests in
`products/jbrowse-web/src/tests/ConfigHydration.test.tsx` and
`rootModel/rootModel.test.ts` cover the hydration cache + reference resolver
end-to-end. Add to the unit tests first when changing resolver logic — they
run in ~2s and pinpoint regressions; integration tests confirm but are slow.
