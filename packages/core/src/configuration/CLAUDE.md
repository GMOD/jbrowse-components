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
`TrackConfigurationReference`, `DisplayConfigurationReference`, or
`ConfigurationReference` dispatch.

### Why frozen

`jbrowse.tracks` is stored as `types.frozen` (plain JS objects). With many
tracks (10k+) the MST overhead of holding every track as an MST instance is
prohibitive; freezing keeps load fast and memory small.

### Hydration

Track configs become MST nodes **lazily**, only when a track is actually opened.
Hydration happens inside `TrackConfigurationReference.get()` via
`frozenTrackCache` (a `WeakMap<frozenObj, MstNode>` in
`configurationSchema.ts`):

- `session.tracksById` returns plain frozen objects for `jbrowse.tracks`.
- On first reference access the resolver calls `schemaType.create(frozen, env)`
  and caches the result keyed by the frozen object.
- The same frozen object always maps to the same MST node (identity-stable).
- When `updateTrackConf` replaces the frozen entry the old WeakMap entry is
  dropped naturally; the next access creates a fresh MST instance.
- Tracks that are never opened are never hydrated.

### Invalid configs (lazy hydration can throw)

Because hydration is `schemaType.create(frozen)`, a structurally-invalid config
(e.g. a bad enum value) throws the moment it's first read. The invariant is that
**`view.tracks` (the open set) only ever holds usable tracks** — so the three
entry points that could put a broken track there all reject it, and downstream
code (toggle/hide/find/menus) never has to defend against a config that throws:

- **Open — `showTrackGeneric`:** eagerly validates the config before pushing;
  invalid → `notifyError` snackbar, nothing added.
- **Add/copy — `SessionTracks.addTrackConf`:** catches the typed-array push (the
  frozen `jbrowse.tracks` doesn't validate, but `sessionTracks` does) → snackbar,
  nothing added.
- **Session load — `filterSessionInPlace`:** drops any open-track element whose
  config can't hydrate (alongside dangling refs), so a saved/shared session with
  a broken open track loads with that track removed instead of crashing.

`notifyError` is available to the first two because `SnackbarModel` is composed
into `BaseSessionModel`. `isTrackModel` still guards its config read defensively,
but with the invariant above it isn't relied upon to prevent crashes.

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

Two load-bearing complications, both for views that hold ephemeral track configs
without registering them in `session.tracks`. Canaries are named so future
agents catch breakage fast:

- **`get` falls back from `tracksById` to MST `resolveIdentifier`.** Required by
  `LinearSyntenyView.viewTrackConfigs` (LinearReadVsRef). Canary:
  `ReadVsRef.test.tsx`.
- **`types.union(trackRef, schemaType)` accepts string id OR full snapshot.**
  Required by `CircularView.addTrackConf` / `SvInspectorView`, which push
  synthesized configs as MST instances. Canary: `SVInspector.test.tsx`.

Simplifying either requires first migrating view-local configs into the session.

Do NOT add `as SCHEMATYPE` to the return value — it narrows `SnapshotIn` to just
the object branch and forces every caller to `@ts-expect-error` string ids. The
inferred union `SnapshotIn` is naturally `string | SnapshotIn<schema>`, which is
what callers want.

### `DisplayConfigurationReference` quirks

- Looks up via `track.configuration.displays.find(d => d.displayId === id)`.
  Linear scan; would benefit from a `displaysById` MobX view on the track config
  but not done yet.
- Falls back to type-match (`d.type === parent.type`) — handles old sessions
  where the saved displayId no longer matches but a display of the same type
  exists on the track. `baseTrackConfig.preProcessSnapshot` injects a stub
  display for every registered displayType on the track, so this fallback always
  succeeds at runtime.
- Throws if both lookups fail. A previous third step would auto-create a
  detached MST node here — removed because preProcessSnapshot's display-stub
  injection makes the path dead, and the detached node was a silent footgun (its
  edits didn't persist).

## Testing the reference layer

Unit tests in `configurationSchema.test.ts` exercise all three flavors with
minimal MST shims (no full session boot needed). Integration tests in
`products/jbrowse-web/src/tests/ConfigHydration.test.tsx` and
`rootModel/rootModel.test.ts` cover the hydration cache + reference resolver
end-to-end. Add to the unit tests first when changing resolver logic — they run
in ~2s and pinpoint regressions; integration tests confirm but are slow.
