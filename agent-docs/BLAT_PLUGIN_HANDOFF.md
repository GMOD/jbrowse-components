# BLAT plugin handoff

Adding UCSC BLAT to **jbrowse-desktop**, modeled on IGV. Goal: from the genome
picker ("show available genomes", jb2hubs-sourced), let users BLAT a pasted
sequence and get results as a track — for **main UCSC genomes** and **GenArk
hubs**.

Status date: 2026-07-02. Branch: `webgl-poc`. Shared worktree — scope commits to
explicit pathspecs (see [[shared-worktree-commit-scope]]); nothing here is
committed yet.

## TL;DR of what's known (don't re-derive)

- BLAT is a thin HTTP/socket client: get a sequence → query a server → parse PSL
  → render a track. No alignment algorithm lives in the client.
- **Main UCSC genomes: easy, works today.** jb2hubs names these assemblies by
  their UCSC db (`ucsc2jbrowse/configs/hg38.json` → `assembly.name === "hg38"`),
  so hgBlat `db=<assembly.name>` just works. `hs1` works too.
- **UCSC hgBlat web CGI is now behind a Cloudflare Turnstile CAPTCHA.** First
  request from a fresh IP returns JSON; subsequent ones return the challenge
  page. igv.js dodges this with a server-side proxy (`igv.org/services/blatUCSC.php`).
- ~~**GenArk-by-accession does NOT work via hgBlat web**~~ **CONTRADICTED
  2026-07-02.** Cold tests of `db=GCF_000001405.40`/`db=GCA_009914755.4` 404'd
  ("Can not find database"), BUT an in-browser `db=GCA_009769605.1&output=json`
  returned valid JSON — the CGI resolved the bare accession itself to
  `"genome":"hub_6551519_GCA_009769605.1"` (no hgsid, no manual hub_N; empty
  `blat:[]` only because the 20bp query had no hits). Open: is resolution
  cart/session-scoped (browser had the hub attached) or global (the two cold
  failures were promoted/special assemblies: GCF_000001405.40≈hg38,
  GCA_009914755.4=hs1)? **RESOLVED: global/stateless** — `db=GCA_009769605.1`
  worked in a fresh incognito session (empty cart) after one Turnstile solve, so
  the cold failures were the promoted red-herring assemblies. **The whole
  gfServer/dynablat/desktop-only path (Task 3) is therefore UNNECESSARY:** one
  web-CGI path (`hgBlat?...&db=<name-or-accession>&output=json`) serves main +
  GenArk identically; only Turnstile gates it. Recommended arch = a single
  STATELESS proxy appending UCSC's official `apiKey=` (UCSC acct → Hub
  Development, primary site only) — both web and desktop call it, no CAPTCHA UX,
  no native binary/socket. Cache + rate-limit it (UCSC caps ~1 hit/15s, 5000/day).
- **GenArk BLAT is feasible via UCSC's dynamic gfServer**, declared in each
  `hub.txt`:
  `blat dynablat-01.soe.ucsc.edu 4040 dynamic <genomeDataDir>` (+ transBlat,
  isPcr). Raw TCP to `dynablat-01:4040` handshakes (`version 37x1 / serverType
  dynamic`). Browser igv.js can't use this (no raw sockets) — it has a
  `// TODO -- blat specific property` and never wires `config.blat`. **Electron
  main CAN** open the socket → this is a desktop-only capability.
- Caveat: raw gfServer returns seed/tile hits, not finished PSL — `gfClient`
  does the stitch. Practical impl = ship/shell `gfClient`, or run our own proxy
  that does.

## What's already built (uncommitted, in this worktree)

New plugin `plugins/blat/`:
- `src/blatQuery.ts` — `buildBlatBody`, `parseBlatResponse` (detects the
  Turnstile HTML → throws `BlatChallengeError`), `pslToFeatures` (21-col PSL →
  features w/ per-block subfeatures + % identity), `runBlat` (web fetch path),
  `DEFAULT_BLAT_URL`, `MINIMUM_BLAT_LENGTH`.
- `src/blatQuery.test.ts` — 3 tests over a real hgBlat JSON fixture. `pnpm test
  plugins/blat` is green.
- `src/BlatDialog.tsx` — Tools-menu dialog: assembly picker, UCSC db (via
  `ucscDbMap`), editable server URL, sequence paste; adds results as a
  `FeatureTrack` w/ `FromConfigAdapter` and `showTrack`s it. On
  `BlatChallengeError` shows an electron-only "Solve CAPTCHA" button.
- `src/desktopBlat.ts` — renderer→main bridge (`window.require('electron')`):
  `desktopBlatFetch`, `openBlatChallenge`.
- `src/ucscDbMap.ts` — tiny static alias map (GRCh38→hg38 etc.); **placeholder,
  to be replaced by real assembly-metadata wiring** (see Task 1).
- `src/index.ts` — registers Tools → "BLAT search…".
- `package.json`, `tsconfig.build.esm.json`.

Desktop wiring (all uncommitted):
- `products/jbrowse-desktop/src/corePlugins.ts` — imports+registers `Blat`.
- `products/jbrowse-desktop/package.json` — adds `@jbrowse/plugin-blat` dep.
- `electron/window.ts` — `createChallengeWindow(url)`: opens the BLAT host in a
  BrowserWindow (shared default-session cookie jar), polls for `cf_clearance`,
  auto-closes on success; resolves false if user closes first.
- `electron/ipc/channels.ts` — new channels `openBlatChallenge(url)→boolean`,
  `blatFetch(url,body)→{ok,status,text}`.
- `electron/ipc/blatHandlers.ts` (new) — `registerBlatHandlers`: `blatFetch`
  does `net.fetch` with `credentials:'include'` on the default session (so a
  solved-challenge cookie attaches first-party — renderer cross-origin fetch
  can't reliably send it due to SameSite); `openBlatChallenge` → challenge window.
- `electron/electron.ts` — calls `registerBlatHandlers()`.

Build state: plugin `tsgo --build` clean, electron `tsgo -p electron/tsconfig.json`
clean, `node scripts/buildElectronMain.ts` bundles (4 blat markers present),
eslint --fix clean.

### pnpm gotcha (already worked around, may recur)
`pnpm install` no-op'd ("Already up to date") and did NOT create the
desktop→plugin symlink or `@mui/icons-material` link. Created manually mirroring
`.pnpm` layout:
- `products/jbrowse-desktop/node_modules/@jbrowse/plugin-blat` →
  `../../../../plugins/blat`
- `plugins/blat/node_modules/@mui/icons-material` → the versioned `.pnpm` path
  (copy the symlink target from `plugins/grid-bookmark/node_modules/@mui/icons-material`).
A clean checkout + real `pnpm install` should regenerate these; the lockfile was
not updated.

## NOT verified end-to-end (needs a human)

The whole thing type/builds but nobody has driven it in a running desktop app:
1. Does the "Solve CAPTCHA" flow actually let the follow-up `net.fetch` through?
   (i.e. does the solved cf_clearance cookie attach as expected. If UCSC's cookie
   isn't named `cf_clearance`, `createChallengeWindow`'s poll needs that name;
   the close-based retry still works regardless.)
2. Does the Tools menu item appear and the track render?
Run: `cd products/jbrowse-desktop && pnpm start` (or the project `run` skill),
open an hg38 session, Tools → BLAT search, paste a ~150bp human sequence.

## Remaining work (proposed order)

### Task 1 — wire main-UCSC genomes to the genome picker (small, do first)
- **jb2hubs** (`~/src/jb2hubs`): in `ucsc2jbrowse` config generation, emit a
  per-assembly BLAT hint. Simplest: `assembly.metadata.blatDb = <name>` (for
  UCSC golden-path it's just the assembly name). Optionally a
  `assembly.metadata.blatServer` override.
- **plugin**: replace the `ucscDbMap` lookup in `BlatDialog` with
  `getConf(assembly, ['metadata','blatDb'])` (fall back to `assembly.name`);
  disable/hide BLAT when there's no resolvable db. Assembly is reachable via
  `session.assemblyManager.get(assemblyName)`.
- "Available genomes" data flows through
  `products/jbrowse-desktop/src/components/StartScreen/availableGenomes/useGenomesData.ts`
  (fetches jb2hubs JSON; `Entry` has `accession` GCF_/GCA_ + `jbrowseConfig` URL).

### Task 2 — reliability of the CAPTCHA problem (decide approach)
Two options; pick one:
- (a) Keep the in-app "Solve CAPTCHA" window (already built) — verify it works
  (see above). Zero infra.
- (b) Host our own blat proxy (like igv.org's) on jbrowse.org/jb2hubs infra —
  server-side handles CAPTCHA + could also shell `gfClient` for GenArk (Task 3).
  Cleaner UX, needs infra + is the natural home for GenArk too.

### Task 3 — GenArk via dynamic gfServer (desktop-only, the real prize)
- **jb2hubs**: harvest each genark `hub.txt` `blat`/`transBlat`/`isPcr` line
  (host, port, `dynamic`, genomeDataDir) into the assembly config metadata.
  hub.txt lives at
  `https://hgdownload.soe.ucsc.edu/hubs/<GCA|GCF>/nnn/nnn/nnn/<acc>/hub.txt`.
- **desktop**: add an IPC path that runs the query against `dynablat-01:4040`.
  Practical impl = bundle/detect `gfClient` and shell:
  `gfClient -t=dna -q=dna -genome=<acc> -genomeDataDir=<dir> dynablat-01.soe.ucsc.edu 4040 <query.fa> <out.psl>`
  then parse the PSL with the existing `pslToFeatures`. (Reimplementing the
  gfServer wire protocol + alignment stitch in Node is possible but large — not
  recommended first.)
- The plugin picks web-hgBlat vs gfServer per assembly based on which hint the
  config carries.

## Key source references
- IGV (java, model): `~/src/vendor/igv/src/main/java/org/igv/util/blat/BlatClient.java`
- igv.js (current, master via raw.githubusercontent): `js/blat/blatClient.js`,
  `js/blat/blatTrack.js` (db=ucscID + TODO), `js/ucsc/hub/hub.js` (parses hub
  `blat` prop), `js/genome/genome.js` (ucscID fallback map).
- jbrowse: `plugins/config/src/FromConfigAdapter`, `plugins/grid-bookmark/src/index.ts`
  (appendToMenu('Tools',...) pattern), `packages/product-core/src/Session/*Tracks.ts`.

See memory [[project-blat-plugin-ucsc-captcha]] for the condensed version.
