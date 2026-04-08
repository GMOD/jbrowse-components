# Code Review Reference: jbrowse-plugin-rl-analytics

A snapshot of the plugin's current architecture, intended as a
reference for a PR reviewer. Describes what the code does today, not
the history of how it got here.

## Purpose

Captures user interactions with a JBrowse 2 session as RL-compatible
`(state, action, reward, next_state)` tuples and exports them as
JSONL or streams them to a webhook. Designed to enable training and
evaluation of agents that operate JBrowse on behalf of users.

## Architecture

```
session ──onAction──▶ ActionListener ──▶ ActionBuffer (debounce)
                                               │
                                               ▼
                                       EpisodeManager
                                       (StateEncoder)
                                               │
                       ┌───────────────────────┴───────────────┐
                       ▼                                       ▼
                 JSONLExporter                          WebhookExporter
                 (delta-encoded)                        (batch + interval)
```

### Source layout (`src/`)

| File | Role |
|------|------|
| `index.ts` | Plugin entry. Installs middleware on the session, wires components, exposes `getExportManager()` / `getEpisodeManager()` / `getActionListener()` for tests via a module-level `WeakMap<Plugin, refs>`. |
| `config.ts` | Six config slots, all consumed via `readConfObject`: `enabled`, `webhookUrl`, `webhookBatchSize`, `webhookFlushIntervalMs`, `inactivityTimeoutMs`, `maxEpisodes`. |
| `ActionLogger/ActionListener.ts` | MST `addMiddleware` listener. Filters sub-actions via `parentActionEvent`. Maps MST action names → semantic `ActionType` via `ACTION_MAP`. Extracts per-action metadata in `extractMetadata()`. |
| `ActionLogger/ActionBuffer.ts` | Debounces same-type actions in a sliding window. Calls `onDebouncedAction` with the merged event. |
| `ActionLogger/ActionTypes.ts` | `ActionType` enum + `ClassifiedAction` shape. |
| `RLPipeline/StateEncoder.ts` | Reads MST view getters → `BrowserState`. Memoizes within a frame keyed on `(bpPerPx, offsetPx, numTracks, firstRegion, lastActionTimestamp)`. Tracks action counts and unique refNames visited. `encode()` returns a fixed 21-dim numeric vector. |
| `RLPipeline/EpisodeManager.ts` | Builds `Step` records from prev/next `BrowserState`, manages episode lifecycle, inactivity timeout (dynamic check interval = clamp(1s, 30s, timeout/2)), bounded ring buffer of completed episodes via `maxEpisodes`. |
| `RLPipeline/types.ts` | `BrowserState`, `Step`, `Episode` types. |
| `Export/ExportManager.ts` | Holds the JSONLExporter and (optional) WebhookExporter; exposes `getJSONL()` for tests/UI. |
| `Export/JSONLExporter.ts` | Serializes episodes to JSONL. Delta-encodes `next_observation` against `observation` to reduce file size. |
| `Export/WebhookExporter.ts` | Buffered POSTer with batch-size and interval triggers. Restores buffer on fetch failure. Uses `navigator.sendBeacon` on dispose if available. |
| `ObserverView/viewModel.ts` | The "Action Monitor" view model. Reactive log via `observable.array<LogEntry>` for O(1) push and stable React keys. |
| `ObserverView/ObserverView.tsx` | The view UI. Uses MUI `useTheme()` for dark/light. `requestAnimationFrame`-coalesced auto-scroll. |

### Tests (`src/__tests__/`)

| File | Tests | Coverage |
|------|-------|----------|
| `ActionBuffer.test.ts` | Debounce window, merge semantics, flush on type change. |
| `EpisodeManager.test.ts` | Episode lifecycle, inactivity timeout, `maxEpisodes` eviction, prevState caching. |
| `StateEncoder.test.ts` | Shape, zoomLevel buckets, label visibility, track type flags, `encode()` vector dims, action count tracking, unique refName tracking, throwing-getter resilience, frame memoization (hit + invalidation). |
| `WebhookExporter.test.ts` | Batch flush, interval flush, empty buffer, fetch-failure restore, `sendBeacon` on dispose, empty-URL disabled — all via mocked `global.fetch`. |

Plus `products/jbrowse-web/src/tests/RLAnalytics.test.tsx`:
end-to-end integration through the real `LinearGenomeView`. Covers
MST `onAction` propagation, full pipeline → JSONL with enriched
state, prevState caching across steps, `SHOW_TRACK` capture, and
delta-encoded JSONL output.

**Total: 35 tests across 5 files.**

## Key design decisions

1. **Middleware on session, not rootModel.** Action capture is scoped
   to a single session; this avoids capturing assembly-loading and
   bootstrap actions that occur before the user takes control.

2. **Plugin state in a `WeakMap`.** No mutable state on the plugin
   instance itself; refs (`actionListener`, `episodeManager`,
   `exportManager`) live in a module-level WeakMap keyed by the
   plugin object. Accessor methods (`getExportManager()` etc.) exist
   for the integration test.

3. **`parentActionEvent` filter.** Suppresses sub-actions like
   `scrollTo` inside `zoomTo`, so only top-level user-initiated
   actions become Steps.

4. **Frame-level state memoization.** `StateEncoder.extractState`
   returns the same object on repeat calls within a frame to avoid
   re-walking MST getters. Invalidated on the next animation frame
   or when any view input changes.

5. **Delta-encoded JSONL.** `next_observation` is stored as the diff
   from `observation`, computed by shallow-equality on each
   `BrowserState` field. The Python converter
   (`scripts/convert_to_gymnasium.py`) reconstructs full
   observations.

6. **`isAlive()` checks** on the observer view in
   `getObserverView()` to handle MST destruction races.

7. **Webhook export is fully optional and gated by config.** If
   `webhookUrl` is empty the exporter short-circuits and never
   touches `fetch`.

## Generated docs

`docs/ACTIONS.md` is auto-generated from `ActionListener.ts` by
`scripts/generate_action_doc.mjs`. It lists all 13 semantic action
types, the MST action names mapped to each, and the metadata fields
extracted per action. Regenerate with:

    node scripts/generate_action_doc.mjs

## Type safety

- Zero `as any` in `index.ts` — uses `AbstractSessionModel` and
  `AbstractViewModel` from `@jbrowse/core/util`, plus a local
  `RootModelWithSession` interface.
- Zero `eslint-disable` in `index.ts`.
- The few `as any` casts in tests are for constructing minimal mock
  views/steps and are isolated to fixtures.

## Metrics

- **Source**: ~1100 lines of TypeScript across 12 source files
- **Tests**: 5 files, 35 tests
- **UMD bundle**: ~36 KB
- **Published tarball**: `"files": ["esm"]` — excludes `scripts/`,
  `docs/`, `dist/`, tests
- **Dependencies**: aligned with the monorepo (`@jbrowse/core`
  workspace, MUI `^7.3.8`, mobx 6.15, mobx-react 9.2)

## Known follow-ups (non-blocking)

1. `extractMetadata` falls back to storing raw `args` for unknown
   action names (`logOtherActions` opt-in). If an unknown action
   passes MST node references, JSON serialization could fail. Safer
   to drop unknown args entirely.
2. A generated Python dataclass for the JSONL `BrowserState` schema
   would let downstream RL training stay in sync with the plugin.
3. `crypto.randomUUID()` requires Node 18+ / jsdom 20+. Fine on
   current CI; flag if the matrix widens.
