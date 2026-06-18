# Status / progress reporting — handoff

Branch `webgl-poc`. Landed in commit `67f70619a5` (2026-06-18). This doc is the
single source of truth for how loading status + determinate progress flows from
workers to the loading UI, and what's left to do.

## The model: one transport

There is **one** out-of-band status channel: `statusCallback`, carrying

```ts
// packages/core/src/util/progress.ts
type RpcStatus = string | StatusWithProgress      // string = indeterminate phase
interface StatusWithProgress { message: string; current: number; total: number }
type StatusCallback = (status: RpcStatus) => void  // canonical type, use everywhere
```

- A plain **string** is an indeterminate phase label (`"Loading features"`).
- A **StatusWithProgress** object adds a determinate fraction. `current`/`total`
  are unit-agnostic (bytes for a download, blocks for an unzip, features for a
  scan). The UI — not the worker — decides presentation, which is why this is an
  object and not a baked `"... 45%"` string: `statusFraction()` needs the
  numeric ratio to draw the bar, the message stays stable while the bar
  animates, and it stays aggregatable / i18n-able.

### Flow

worker adapter/RPC → `opts.statusCallback(status)` → (RPC drivers special-case
`statusCallback` as out-of-band, message type `unknown`, so objects cross fine)
→ main thread → `FetchMixin.setStatusMessage(status: RpcStatus)` splits it into
`statusMessage` (via `statusMessageText`) + `statusProgress` (via
`statusFraction`) → `DisplayLoadingOverlay` renders a determinate bar + % +
cancel when `statusProgress` is set, else a spinner + message.

`statusCallback` is the only channel the RPC drivers wire. There is **no**
`onProgress` channel — an earlier attempt added a second `BaseOptions.onProgress`
that was never RPC-wired (dead) and has been removed. Don't reintroduce it; emit
through `statusCallback`.

## Helpers (`packages/core/src/util/progress.ts`)

| Helper | Use |
| --- | --- |
| `downloadStatusReporter(statusCallback, label)` | Adapts the byte-granularity `onProgress(bytes,total)` from `@gmod/tabix`/`@gmod/bam`/`@gmod/cram` to the structured transport; returns `undefined` when no `statusCallback` so the reader skips bookkeeping. **One home for this** — reuse it, don't re-inline. |
| `createProgressReporter({label,total,statusCallback,stopToken})` | Per-iteration `report(current)` for long worker CPU loops: throttled cancel-check + throttled object emit. With no `statusCallback`/`total` it's a pure cancel-tick. |
| `withProgress({label,total,statusCallback,stopToken}, fn)` | Determinate phase wrapper; the counterpart to `updateStatus`. |
| `updateStatus(label, statusCallback, fn)` | Indeterminate phase: sets `label`, runs `fn`, clears. |
| `statusMessageText(status)` / `statusFraction(status)` | Extract text / `[0,1]` fraction from any `RpcStatus`. |

## Pattern: forwarding download progress in a feature adapter

See `plugins/variants/src/VcfTabixAdapter/VcfTabixAdapter.ts` (and SplitVcf). The
`updateStatus` wrapper owns the label + clear; `onProgress` upgrades the
in-between status to a determinate bar:

```ts
await updateStatus('Downloading variants', statusCallback, () =>
  vcf.getLines(refName, start, end, {
    signal: opts.signal,
    lineCallback: (line, fileOffset) => { observer.next(...) },
    onProgress: downloadStatusReporter(statusCallback, 'Downloading variants'),
  }),
)
```

Do **not** spread `...opts` into `getLines` — that was the old footgun (jbrowse
`onProgress` object collided with tabix `onProgress(bytes,total)`). Pass only
`signal` + `lineCallback` + `onProgress`.

## gmod libraries (published, separate repos)

- `generic-filehandle2` 2.2.0 — `FilehandleOptions.onProgress(bytesReceived, total?)`; streams body into one pre-sized buffer when Content-Length known.
- `@gmod/tabix` 3.4.0 — `getLines({ onProgress(bytesDownloaded, totalBytes) })`, block granularity (cache hits tick instantly). **Not modified** — positional byte callback is the correct low-level primitive.
- `@gmod/bam` 7.3.0, `@gmod/cram` 8.3.0 — `getRecordsForRange({ onProgress })`.

## TODO / follow-ups

- **Wire bam/cram download progress.** Installed `@gmod/bam` is still **7.2.4**
  (no `onProgress`) even though 7.3.0 is published and dep is `^7.2.4`. Bump the
  lockfile (`pnpm install` / update bam+cram), then in
  `plugins/alignments/src/{BamAdapter,CramAdapter}` add
  `onProgress: downloadStatusReporter(statusCallback, 'Downloading alignments')`
  to the `getRecordsForRange` opts (currently wrapped only in `updateStatus`).
  Same for bed/gff tabix adapters if desired.
- **Co-edited holdout:** `plugins/canvas/src/LinearBasicDisplay/baseModel.ts` has
  another agent's "Filter by" feature uncommitted. My 1-line `RpcStatus` lambda
  fix (the `statusCallback: (msg: RpcStatus) => ...` at the RPC call) is left
  **uncommitted in the working tree** to ride along with their commit — don't
  drop it. If they've already committed, commit just that hunk.
- **Legacy string-only consumers** (synteny display, dotplot/wiggle progress
  dialogs) extract `statusMessageText(msg)` and show no bar. Upgrading them to a
  determinate bar means storing `RpcStatus` (not a `string`) in their state /
  FetchMixin migration — optional, low priority.

## Don't

- Don't add a parallel progress channel; emit through `statusCallback`.
- Don't bake percentages into the message string.
- Don't type a status callback as `(msg: string) => void` — use `StatusCallback`
  (or `(msg: RpcStatus)` for an inline lambda) so determinate progress can flow.
