# Configuration package

## `getConf` vs `readConfObject`

Two reader functions, intentionally distinct:

- `getConf(model, path)` — when you hold a model that _has_ a `.configuration`
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
(`TracksManagerSessionMixin`). The hydration cache is a
`WeakMap<frozenObj, MstNode>`, so:

- The same frozen object always maps to the same MST node (identity-stable
  across reads).
- When `updateTrackConf` replaces the frozen entry, the WeakMap entry is dropped
  naturally, and the next read produces a _new_ MST instance.
- Unchanged sibling tracks keep their identity because their frozen reference is
  unchanged.

### Reference resolution

Track and display state models hold their config via `ConfigurationReference`.
Dispatch lives in `configurationSchema.ts:ConfigurationReference`, keyed on the
schema's `explicitIdentifier`:

| `explicitIdentifier` | Branch                           |
| -------------------- | -------------------------------- |
| `'trackId'`          | `TrackConfigurationReference`    |
| `'displayId'`        | `DisplayConfigurationReference`  |
| anything else        | plain `types.union(ref, schema)` |

Most concrete display schemas don't declare `displayId` directly — they inherit
it through `baseConfiguration: baseLinearDisplayConfigSchema`, which
`preprocessConfigurationSchemaArguments` merges into the subclass's options.

### `TrackConfigurationReference` quirks

Two load-bearing complications, both for views that hold ephemeral track
configs without registering them in `session.tracks`. Canaries are named so
future agents catch breakage fast:

- **`get` falls back from `tracksById` to MST `resolveIdentifier`.** Required
  by `LinearSyntenyView.viewTrackConfigs` (LinearReadVsRef). Canary:
  `ReadVsRef.test.tsx`.
- **`types.union(trackRef, schemaType)` accepts string id OR full snapshot.**
  Required by `CircularView.addTrackConf` / `SvInspectorView`, which push
  synthesized configs as MST instances. Canary: `SVInspector.test.tsx`.

Simplifying either requires first migrating view-local configs into the
session.

Do NOT add `as SCHEMATYPE` to the return value — it narrows `SnapshotIn` to
just the object branch and forces every caller to `@ts-expect-error` string
ids. The inferred union `SnapshotIn` is naturally `string | SnapshotIn<schema>`,
which is what callers want.

### `DisplayConfigurationReference` quirks

- Looks up via `track.configuration.displays.find(d => d.displayId === id)`.
  Linear scan; would benefit from a `displaysById` MobX view on the track config
  but not done yet.
- Falls back to type-match (`d.type === parent.type`) — handles old sessions
  where the saved displayId no longer matches but a display of the same type
  exists on the track.
- Last-ditch: creates a detached config via `schemaType.create(...)` — handles
  new display types added to the schema that weren't present in the saved track
  config. **CAVEAT:** the auto-created node is orphaned; it is not in
  `track.configuration.displays`, so edits via the editor widget will not
  persist. Acceptable for ephemeral defaults; if persistence matters, append to
  the displays array via an action.

## Testing the reference layer

Unit tests in `configurationSchema.test.ts` exercise all three flavors with
minimal MST shims (no full session boot needed). Integration tests in
`products/jbrowse-web/src/tests/ConfigHydration.test.tsx` and
`rootModel/rootModel.test.ts` cover the hydration cache + reference resolver
end-to-end. Add to the unit tests first when changing resolver logic — they run
in ~2s and pinpoint regressions; integration tests confirm but are slow.
