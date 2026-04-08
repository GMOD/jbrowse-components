# @jbrowse/plugin-rl-analytics

A JBrowse 2 plugin that instruments user interactions for reinforcement
learning research. Captures semantic user actions (pan, zoom, track toggle,
feature click, etc.) along with rich browser state observations, and exports
them as JSONL for offline RL training.

## What it does

The plugin intercepts MST actions on the JBrowse session tree via
`addMiddleware`, classifies them into a canonical action vocabulary, and
records (state, action, next_state) tuples with ~21 dimensions of browser
state per step. Data is exported as newline-delimited JSON compatible with
Gymnasium/d3rlpy offline RL pipelines.

A built-in view (the **Action Monitor**) provides a live terminal-style
log of what the instrumentation is capturing, useful for development and
demonstration.

## Installed as a core plugin

The plugin is registered in `products/jbrowse-web/src/corePlugins.ts`, so
it's available in any JBrowse 2 build that includes this monorepo. To use
it in a session, either:

- Add `&rlObserver` to the URL to auto-open the Action Monitor view, or
- Open it via **Add → Action Monitor** in the menu.

Data is exported via **Tools → Export RL Data (JSONL)**.

## Using the plugin parasitically on a remote JBrowse instance

The plugin can also be deployed as a UMD bundle that loads into any
existing JBrowse 2 instance without rebuilding it.

### 1. Build the UMD bundle

```bash
cd plugins/rl-analytics
pnpm build:umd
```

This produces `dist/jbrowse-plugin-rl-analytics.umd.js` (~36 KB).

### 2. Host the UMD bundle

Upload `dist/jbrowse-plugin-rl-analytics.umd.js` to any CORS-accessible
static host (S3 public bucket, GitHub Pages, Vercel, Cloudflare Pages, etc.).

### 3. Generate a parasitic config

Point the generator at the target JBrowse instance. It fetches that
instance's `config.json`, resolves all relative data URIs to absolute, and
injects the plugin entry.

```bash
node plugins/rl-analytics/scripts/generate_parasitic_config.mjs \
  https://jbrowse.org/code/jb2/main \
  https://your-cdn.com/jbrowse-plugin-rl-analytics.umd.js \
  https://your-webhook.com/ingest \
  > parasitic_config.json
```

Arguments:
- **Source URL** — the base URL of the target JBrowse instance
- **Plugin URL** — where you hosted the UMD bundle in step 2
- **Webhook URL** (optional) — endpoint for real-time data collection

### 4. Serve the parasitic config

Host `parasitic_config.json` on a CORS-accessible server. Then navigate
to the target JBrowse instance with `?config=` pointing at your config:

```
https://jbrowse.org/code/jb2/main/?config=https://your-server.com/parasitic_config.json
```

The plugin loads at runtime, instruments the session, and (if a webhook URL
was configured) streams action data to your endpoint.

### 5. Run the webhook receiver (optional)

A lightweight Node HTTP server is included for collecting webhook data.
It has no dependencies beyond `node:http` and `node:fs`.

```bash
node plugins/rl-analytics/scripts/webhook_receiver.mjs 8081 ./collected.jsonl
```

Endpoints:
- `POST /ingest` — receives `{steps: [...]}` from WebhookExporter
- `GET /status` — collection stats
- `GET /episodes` — episode summary

### 6. Convert JSONL to Gymnasium format

Exported JSONL can be converted to NumPy `.npz` files compatible with
d3rlpy and Decision Transformer:

```bash
python3 plugins/rl-analytics/scripts/convert_to_gymnasium.py \
  exported.jsonl \
  exported.npz
```

Output arrays: `observations` (N × 21 float32), `actions` (N int64),
`rewards` (N float32 — zero, for post-hoc reward shaping), `terminals`
(N bool), `timeouts` (N bool).

## Observation space (21 dimensions)

Per step, the state vector includes:

| Fields | What it encodes |
|--------|----------------|
| `bpPerPx`, `offsetPx`, `viewWidthPx`, `viewportBp`, `viewportCenterBp` | Viewport geometry and position |
| `zoomLevel` | Semantic zoom: `genome`/`region`/`gene`/`sequence`/`basepair` |
| `hasReferenceSequence`, `hasGeneTrack`, `hasAlignmentTrack`, `hasVariantTrack`, `hasQuantitativeTrack` | Track-type presence flags |
| `activeTracks[]` | Full track list with trackId, trackType, displayType, height, colorScheme, sortedBy |
| `labelsVisible`, `visibleContentBlocks`, `openWidgets[]`, `displayedRegions[]` | What the user can currently see |
| `timeSinceLastAction`, `actionsInLast5Seconds`, `sessionDurationMs` | Temporal features |
| `actionCountsByType`, `uniqueRefNamesVisited`, `totalActionsThisSession` | Session-level behavior |

## Action vocabulary

Captured MST actions are classified into these semantic types:

| Type | MST actions | Metadata |
|------|------------|----------|
| `ZOOM` | zoomTo, moveTo, setNewView | target bpPerPx, refName |
| `PAN` | horizontalScroll, scrollTo | distance (px), offset |
| `NAV_TO` | navToLocString, navToSearchString | raw search text, parsed target |
| `SHOW_TRACK` / `HIDE_TRACK` | showTrack, toggleTrack, hideTrack | trackId |
| `REORDER_TRACK` | moveTrack, moveTrackUp/Down/ToTop/ToBottom | resolved source/target trackIds |
| `CONFIG_CHANGE` | setColorScheme, setSortedBy, setShowCenterLine, exportSvg, ... | config-specific (colorBy, sortBy, etc.) |
| `OPEN_WIDGET` | addWidget | widget type (e.g. BaseFeatureWidget for feature clicks) |
| `BOOKMARK` | addBookmark, addToHighlights | highlight region |
| `UNDO` | undo, redo | operation name |
| `ADD_VIEW` / `REMOVE_VIEW` | addView, removeView | view type |
| `FLIP_VIEW` | horizontallyFlip | — |

## Configuration

Available config slots (all optional, with sensible defaults):

| Slot | Type | Default | Description |
|------|------|---------|-------------|
| `actionBufferSize` | number | 10000 | Max actions buffered |
| `debounceMs` | number | 500 | Debounce window for merging rapid actions |
| `inactivityTimeoutMs` | number | 300000 | Episode timeout on inactivity |
| `maxEpisodes` | number | 100 | Max completed episodes in memory |
| `logOtherActions` | boolean | false | Log unclassified MST actions (debugging) |
| `webhookUrl` | string | '' | Real-time webhook endpoint (empty = disabled) |

## Reward

The exported JSONL sets `reward: 0` for every step. Reward is assigned
post-hoc by the RL researcher based on the objective they're training
toward (e.g., "navigated to a gene" = +1, "oscillated without progress"
= -1). Reward shaping is a post-processing step on the JSONL, not
instrumentation.

## Testing

```bash
cd ../..  # repo root
pnpm jest --passWithNoTests plugins/rl-analytics products/jbrowse-web/src/tests/RLAnalytics
```
