---
name: driving-the-app
description: How do you see or probe a change in the running app when no test reaches it? The blankest session, the dev server, probes against the built app, hosted configs and unreleased plugins, Desktop under xvfb, component previews, share links, probe corpora.
audience: internal
kind: operations
---

# Driving and probing the running app

For readiness gates and the capture library, read the `jbrowse-capture` skill
first; figure and tour specifics are in [FIGURE_CAPTURE.md](FIGURE_CAPTURE.md)
and [VIDEO_TOURS.md](VIDEO_TOURS.md). This doc covers reaching a state, and
reading it back out, when no test does.

## Start from the blankest session

A full session spec hides which half is broken. The ladder, blankest first:

- **No `config`**: `NoConfigMessage` and its sample-data links. Proves the app
  boots, nothing more.
- **`?config=<url>&session=spec-{"views":[]}`**, the useful rung: the config's
  assemblies and track catalog load with zero views. It outranks both the
  config's `defaultSession` and a `hubURL` still in the address bar
  (`SessionLoader.test.ts`). `sessionSpec(cfg, { views: [] })` writes it.
- **`?config=<url>`**: the config's own `defaultSession`.
- **A full `session=spec-{…}`**: what every figure spec does.

Load a misbehaving config, demo or capture at the second rung and add back one
track at a time. The OrthoFinder demos named `.tbi` files that no longer
existed and the stacked synteny figure still drew, because the ribbons come off
the `.blocks` adapter; one gene track on a blank session put the error first on
screen. The same rung makes the better live link for a tour.

## The dev server serves current source

`NODE_ENV=development node scripts/start.ts` in `products/jbrowse-web` (with
`PORT=<n> BROWSER=none`, and `--experimental-strip-types` from a worktree)
serves the app from source, `test_data` included, and rebuilds on edit, so a
puppeteer check of a source change skips the build. `openJBrowse` from
`products/jbrowse-capture/src/index.ts` takes it as `instance`
(`instance: 'http://localhost:3000/'`,
`config: 'http://localhost:3000/test_data/volvox/config.json'`).

- The first compile takes a few minutes, and its `PackFileCacheStrategy …
  Expected end of object` warnings are noise; an edit lands in about a minute.
- A script importing the capture library lives in the repo: under
  `products/jbrowse-capture/src/`, or `products/jbrowse-web/browser-tests/tmp-*.ts`
  (gitignored). A scratchpad script cannot resolve workspace packages. Delete
  it after.
- **It can serve the old module across a `git checkout`**, and deleting
  `node_modules/.vite` does not help. Restart it for each A/B arm and put a
  positive marker in the probe, so a stale module cannot read as a null result.
- Closing a view, then changing something its components observed, logs MST
  `no longer part of a state tree` warnings from StrictMode's uncommitted
  double renders, disposed about 10 s later. Delaying the write 15 s makes them
  go; count against a baseline with the write disabled.

## A probe against the built app

Check `products/jbrowse-web/browser-tests/suites` for a suite that enters the
mode first. If none does, write a ~40-line `browser-tests/tmp-<name>.ts` with
`startServerOnFreePort` + `setPort`, `navigateWithSessionSpec` and
`waitForDataLoaded`, and drive `window.JBrowseSession` (for example
`views[0].tracks[0].displays[0].setGroupBy({ type: 'strand' })`).

- **Read the model's derivation back beside the screenshot** (for lanes,
  `display.lanes.map(l => ({ key, label, maxY, regions: l.laidOutPileupMap.size }))`),
  then look at a crop (`convert … -crop 500x120+300+330 -resize 200%`): read
  direction per lane is invisible at full-page scale. A lane refactor once
  passed 2000 jest tests and every golden while wrong in the one mode no test
  entered.
- **A hosted config naming an `esmUrl` plugin stalls on the trust dialog**,
  which renders outside `#root`, so the probe reports `#root stayed empty` with
  no console error. Seed `localStorage['jbrowse-trusted-plugins']` with the
  plugin URL in `evaluateOnNewDocument`, as `trustCapturePlugins`
  (`website/scripts/screenshot-page.ts`) does. That list names the repo copy's
  URL, so diff a hosted config against `demos/<name>` before blaming the build.
- **Drive the real component, not a page shaped like it.** A standalone repro
  reproduces your model of the code and can answer backwards: one said the
  `WorkspaceLayout` splitter selects the text it crosses, and the real
  `Splitter` did not. A probe reporting an absence needs a control producing
  the presence on the same page.
- **A loading state over local `test_data` finishes before any screenshot**,
  and what you catch is the click's MUI transition (two radios checked at once).
  Hold it open with CDP `Network.emulateNetworkConditions` (latency 1500,
  throughput 20000), gate on the loading text with `waitForFunction`, then
  restore with latency 0 and throughput -1.
- **A worker that never boots**: launch puppeteer Firefox with
  `extraPrefsFirefox: { 'dom.workers.maxPerDomain': 4 }` and it queues every
  worker past the cap without an event; that reproduced the GFF3 tabix
  "Downloading features 0%" hang in one try. Puppeteer Chrome's `workercreated`
  reports nested blob workers. Judge a display done by
  `displayPhase === 'ready'`, not `isLoading`, which is false between an
  aborted fetch and its replacement.
- **Which Suspense boundary shows a fallback**: a fake
  `__REACT_DEVTOOLS_GLOBAL_HOOK__` whose `onCommitFiberRoot` finds fibers with
  `tag === 13` and non-null `memoizedState`
  (`probe-coldload-phases.ts --arms=suspense`). What it waits on: patch
  `Promise.prototype.then` for calls whose two arguments are one function
  (React's `wakeable.then(ping, ping)`). A main thread idling mid-boot with a
  `TimerInstall` of at most 300 ms from `performWorkOnRoot` is React 19's
  reveal throttle ([COLD_LOAD_PROFILE.md](COLD_LOAD_PROFILE.md)).
- **Without a browser**: from a display's `testEnv.ts`, mock the RPC data,
  `renderToString(renderSvg(display))` inside a white-backed `<svg>`,
  `rsvg-convert`, and read the PNG.

## Hosted configs and unreleased plugins

- **The https app blocks a config served from localhost** (mixed content,
  refused before the request leaves). Use the http dev server as `--instance`.
  A config on another origin that names plugins stops at the trust dialog and
  the capture times out with "found no census": put it in
  `test_data/<scratch>/` on the dev server's own origin (the plugin's `esmUrl`
  may stay cross-origin), rewrite its relative `uri`s as absolute, and delete it
  before committing.
- **A hosted multi-way star** captures without a build:
  `node --experimental-strip-types products/jbrowse-capture/src/bin.ts --instance https://jbrowse.org/code/jb2/main --config https://jbrowse.org/ucsc/mm39/config-staging.json --spec spec.json -o out.png --timeout 300000`,
  with the session the genomes portal's gene page writes for its star link (a
  `MultiWaySyntenyDisplay` with `laneFilter`, `domain` and a height of
  34 px per lane plus one).
- **An unreleased plugin in a real figure session**: copy the hosted
  `ucsc/hg38/config.json` and rewrite every relative path against its URL, not
  only `uri` keys (a relative `chromSizes` broke the assembly, and every
  coordinate mapping in the plugins computed nothing without an error). Point the
  plugin entries at `esmUrl: http://localhost:<port>/<dir>/<name>.esm.js` with
  each plugin's whole `dist/` copied there, and serve with `npx serve --cors`;
  a loopback app reading a loopback config skips the trust prompt
  (`configNeedsNoPrompt`). Decode the figure's session from
  `liveLinks.generated.ts`, edit it, and load `?config=…&session=encoded-…`.
  Pass `--concurrency 1` (NCBI's ortholog API answers 429 to two captures) and
  `--localport`.

## Desktop

**What a Desktop command line opens**, with no window on screen:
`pnpm build` in `products/jbrowse-desktop`, then a script importing
`test/mcpHarness.ts` by absolute path. `serveRendererBuild()`, spawn the
electron binary with `['.', '--no-sandbox', '--ozone-platform=x11', ...args]`,
`cwd` at the desktop root, `detached: true`, env `DEV_SERVER_URL` and
`WAYLAND_DISPLAY: ''`, under `xvfb-run -a`. Then `waitForBridge`,
`startMcpClient`, `initialize`, and poll `run_javascript` with
`await jb.waitReady(20000)`; `callAll('screenshot', {})` returns base64.

- Without the ozone switch Electron picks Wayland and exits.
- Pass data files as absolute paths; a data-folder `cwd` fails as "bridge
  socket never came up".
- One app holds the per-user bridge socket: `killGroup(app)` between launches.
- A fresh worktree's first `require('electron')` downloads the binary and that
  launch fails; rerun. If the download fails, point
  `ELECTRON_OVERRIDE_DIST_PATH` at the primary's
  `node_modules/.pnpm/electron@<ver>_*/node_modules/electron/dist`.

**One component, or the whole renderer, under vite** beats packaging by an
hour: a throwaway vite root in `products/jbrowse-desktop/__debug_output__/`
(gitignored, deps resolve) plus puppeteer.

- The vite config imports nothing: `vite` and `@vitejs/plugin-react` are
  transitive and unresolvable from the root. Export a plain object with
  `esbuild: { jsx: 'automatic' }` and run vite by its `.pnpm` path.
- `src/ipc.ts` destructures `ipcRenderer` at module scope, so stub
  `window.require` in a `<script>` in index.html; a `resolve.alias` does not
  match the raw specifier.
- For the whole renderer, render `src/components/Loader.tsx`; the stub's
  `invoke` answers `listSessions`, `loadThumbnail`, `getGlobalPlugins` (`[]`)
  and `newAutosavePath`. In an `enforce: 'pre'` plugin: resolve `node:*` and
  `ixixx` to one no-op stub (stub, never polyfill `buffer`), with `ixixx` in
  `optimizeDeps.exclude`; transform `makeWorkerInstance.ts` to a
  `{ type: 'module' }` worker; and drop `plugins` from hosted
  `ucsc/*/config.json` fetches, since a module worker cannot `importScripts` a
  UMD plugin.
- Read toggle state from the DOM (`aria-pressed`), not a screenshot's colors:
  MUI renders different controls in jsdom and Chrome. For a controlled text
  input, read `selectionStart` after typing into the middle of a value, and run
  an IME composition over CDP (`Input.imeSetComposition`, then
  `Input.insertText`).

## A share link

A bug report's `session=share-<id>&password=<pw>` reads without a browser:
`curl 'https://share.jbrowse.org/api/v1/load?sessionId=<id>'` gives
`{"session": "<b64>"}`; `openssl enc -d -aes-256-cbc -md md5 -a -A -k <pw>`
decrypts it (crypto-js's OpenSSL format, `packages/core/src/util/aes.ts`); the
result is url-safe base64 of deflate (swap `-`/`_` for `+`/`/`, pad, then
`zlib.inflateSync`). Its `sessionTracks` name the adapter URIs, so
`tabix -h <uri> <region>` pulls the records the user saw.

## Corpora and levers

- **`test_data/config_demo.json`'s `ncbi_08_24` RefSeq track filters to
  `geneLike`**, so it never shows the gene-plus-evidence mix a user loading the
  same GFF gets: at chr17:7.15-8.15 Mb it draws 88 features against 758. Probe
  label density and fit decimation after `display.setGenesFilter(undefined)`.
- **`gencode_nclist_hg38`** in the same config is a packer corpus: RBM33
  (chr7:155.62-155.68M), MHC chr6:31.5-31.7M, chr19:1-2M.
- **The hosted liftOver PIFs**
  (`jbrowse.org/ucsc/hg38/liftOver/hg38To<Mate>.over.pif.gz`) are real
  chromosome-scale CIGARs: `tabix <url> qchr1` gives the fine rows (`cg:Z`),
  `Qchr1` the coarse (`cr:Z`), `t`/`T` the other axis. Unit fixtures hide that
  real blocks put most indel bases in a few huge gaps. Run tabix from a scratch
  dir; it caches the remote index in cwd.
- **Multi-way lane UI** (changes chip, Go to, failure notes) needs
  `jbrowse.org/demos/hprc_multiway/config.json` (track `hprc_multiway`,
  `chr1:196,640,000-196,900,000`, the CFHR3-CFHR1 deletion): volvox's deletion
  is under `SPLIT_AT_GAP_BP`. The spec's track sets
  `type: 'MultiWaySyntenyDisplay'`, since a bare trackId opens the pairwise
  display. `setLaneGenes(… { error })` shows a failure note; gene hit boxes
  cover the gene row's top, so scan y from `glyphTop`.
- **A lane frame rule previews on the hosted app**: open a figure's
  `liveLinks.generated.ts` query on `jbrowse.org/code/jb2/main/`, wait for
  `laneDecisions.size > 0`, compute new decisions in-page and hand them to
  `display.setLaneFrames(display.renderOriginPx, map)`. The frame autorun reads
  `laneDecisions` untracked, so they hold until the next settle. Writing a
  config map directly throws MST's protected-node error; use
  `configuration.rows.setSlot`.
