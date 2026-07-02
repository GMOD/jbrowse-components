# BLAT plugin handoff

Adding UCSC BLAT to **jbrowse-desktop**, modeled on IGV. Goal: from the genome
picker ("show available genomes", jb2hubs-sourced), let users BLAT a pasted
sequence and get results as a track — for **main UCSC genomes** and **GenArk
hubs**.

Status date: 2026-07-02. Branch: `webgl-poc`. Shared worktree — scope commits to
explicit pathspecs (see [[shared-worktree-commit-scope]]).

**The plugin work IS committed** (in the "Updates"/"Format" commits — the earlier
"nothing committed yet" note is obsolete).

### Decisions locked (2026-07-02)
- **Stays in the monorepo** (`plugins/blat/`), NOT moved to a standalone
  `jbrowse-plugin-blat` in `~/src/jb2plugins/`. Rationale: external plugins
  diverge quickly. Being in the monorepo it can still build into both products.
- **Bundled in jbrowse-desktop only**, NOT jbrowse-web by default (web's
  cold-load bundle is size-sensitive; BLAT is niche). Web support, if wanted
  later, would come via the plugin store or explicit config, not corePlugins.
- **apiKey layered ON TOP of the CAPTCHA solver — solver KEPT.** UCSC's `apiKey`
  bypasses the Turnstile (per UCSC docs). But we have no key and no proxy yet, so
  the electron CAPTCHA-solve window stays as the working fallback; the apiKey is
  the preferred path when a key is supplied. Don't remove the solver until the
  apiKey path is verified working end-to-end.
- **apiKey delivery = proxy default + desktop own-key override** (see
  Architecture below).

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

## Architecture: how the apiKey/CAPTCHA problem is solved

UCSC **removed open programmatic BLAT access in 2025 due to bot abuse**; the
Cloudflare Turnstile is what a keyless request hits. UCSC ships the intended
escape hatch: **an `apiKey` bypasses the CAPTCHA on the CGIs including hgBlat.**
- Get one: log into a UCSC Genome Browser account → **Hub Development** page →
  API key section at the bottom → generate. Primary `genome.ucsc.edu` only.
- Use it: append `&apiKey=YOUR_KEY` to the request (we add it to the POST body).
- BLAT rate limit stays **1 hit / 15 s, 5000 / day** even with a key.

Three paths, in preference order:
- **Desktop CAPTCHA solve-window (WORKS TODAY, no key needed):** on
  `BlatChallengeError` the dialog offers "Solve CAPTCHA"; `createChallengeWindow`
  opens the BLAT host, the solved `cf_clearance` cookie lands in the default
  session, and the follow-up `blatFetch` (`credentials:'include'`) carries it.
  This is the current working desktop path and stays until apiKey is proven.
- **Desktop own-key override:** the user pastes their own apiKey; desktop POSTs
  straight to hgBlat through the `blatFetch` bridge (electron `net.fetch` is not
  CORS-bound). No proxy, no CAPTCHA — testable the moment someone has a key.
- **Proxy (the only web-viable path):** a CORS-enabled server (jbrowse.org
  infra, like igv.org's `blatUCSC.php`) holds ONE shared apiKey and injects it.
  A browser fetch straight to genome.ucsc.edu is CORS-blocked regardless of key,
  so web *must* go through this. **NOT yet built.**

Trade-off: the shared proxy key shares one 5000/day + 1-per-15s budget across
all users; the desktop own-key override is the pressure valve.

## What's built (committed, in `plugins/blat/`)

- `src/blatQuery.ts` — `buildBlatBody({db,seq,apiKey})`, `parseBlatResponse`
  (Turnstile HTML → `BlatChallengeError`; other HTML → readable error),
  `pslToFeatures` (21-col PSL → features w/ per-block subfeatures + % identity),
  `runBlat({db,seq,urlBase,apiKey})`, `DEFAULT_BLAT_URL`, `MINIMUM_BLAT_LENGTH`.
- `src/blatQuery.test.ts` — 3 tests over a real hgBlat JSON fixture, green.
- `src/BlatDialog.tsx` — Tools-menu dialog: assembly picker, UCSC db (via
  `ucscDbMap`), editable server URL, **optional apiKey field**, sequence paste;
  adds results as a `FeatureTrack` w/ `FromConfigAdapter` and `showTrack`s it.
  Desktop routes through `desktopBlatFetch` (CORS bypass), web uses `runBlat`.
  On `BlatChallengeError` shows the electron-only "Solve CAPTCHA" fallback.
- `src/desktopBlat.ts` — renderer→main bridge: `desktopBlatFetch` +
  `openBlatChallenge` (the CAPTCHA-solve fallback).
- `src/ucscDbMap.ts` — tiny static alias map (GRCh38→hg38 etc.); identity
  default already covers name===db and bare GenArk accessions. `metadata.blatDb`
  wiring (Task 1) is optional polish, not required for the common case.
- `src/index.ts` — registers Tools → "BLAT search…".

Desktop wiring (committed):
- `products/jbrowse-desktop/src/corePlugins.ts` + `package.json` — registers
  `Blat` / `@jbrowse/plugin-blat` dep. **Desktop only** — deliberately NOT added
  to jbrowse-web corePlugins (bundle size; BLAT is niche).
- `electron/ipc/channels.ts` + `blatHandlers.ts` — two channels:
  `blatFetch(url,body)` (main-process `net.fetch` POST, `credentials:'include'`
  so a solved cookie attaches, bypasses renderer CORS) and
  `openBlatChallenge(url)` → `createChallengeWindow`.
- `electron/window.ts` — `createChallengeWindow`: opens the BLAT host, polls for
  `cf_clearance`, auto-closes on success.
- `electron/electron.ts` — calls `registerBlatHandlers()`.

The apiKey field is **additive**: nothing from the CAPTCHA-solve path was
removed. Only the earlier jbrowse-web corePlugins registration was reverted.

Build state: plugin `tsgo --build` clean, electron `tsgo -p
electron/tsconfig.json` clean, `pnpm test plugins/blat` green, eslint clean.

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

## Verification status

- **Desktop CAPTCHA solve path (the working one):** manually exercised — user
  solves the Turnstile window and BLAT returns results. This is the current
  shipping behavior; keep it.
- **apiKey path — NOT verified.** That `hgBlat?...&apiKey=KEY&output=json`
  returns JSON (not Turnstile HTML) is from UCSC docs, not yet reproduced —
  nobody on the project has a key. Verify with the curl in Step 1 before relying
  on it. Everything type/builds and unit-tests pass.

## Remaining work (proposed order)

### Step 1 — get a UCSC apiKey and verify the assumption (unblocks apiKey path)
Nobody on the project has a key yet. Acquire: UCSC Genome Browser account →
**My Data / Hub Development** page → API key section → generate. Then:
```
curl -s 'https://genome.ucsc.edu/cgi-bin/hgBlat' \
  --data-urlencode 'userSeq=<~150bp human seq>' \
  --data-urlencode 'type=DNA' --data-urlencode 'db=hg38' \
  --data-urlencode 'output=json' --data-urlencode 'apiKey=YOUR_KEY'
```
JSON back = apiKey/proxy design is locked; paste the key into the dialog's
apiKey field and the desktop own-key path works with no CAPTCHA. Turnstile HTML
back = rethink; the CAPTCHA solve-window fallback still works meanwhile.

### Step 2 — deploy the BLAT proxy (unlocks web + keyless desktop)
**Scaffolded: `aws/blat-proxy/`** (AWS SAM Lambda, mirrors jb2hubs'
`aws/config-merger`). It's a transparent proxy: `POST /blat` takes the exact
form-encoded hgBlat body the plugin already sends, forces `apiKey` (from the
`UCSC_API_KEY` env var / SAM `UcscApiKey` param) + `output=json`, relays JSON,
adds `Access-Control-Allow-Origin: *`. Pure logic (`src/proxy.ts`) is unit-tested
(`pnpm test`, 5 green); `pnpm build` bundles to `dist/index.mjs`; `pnpm typecheck`
clean. Deploy: `UCSC_API_KEY=... ./deploy.sh` (needs SAM CLI + a key from Step 1).
Then point the plugin's "BLAT server URL" field (or `DEFAULT_BLAT_URL`) at the
`BlatProxyApiUrl` stack output. Web can't work without this (browser→UCSC is
CORS-blocked regardless of key).
- **STILL TODO in the proxy:** rate limiting. UCSC caps 1/15s + 5000/day and the
  proxy uses ONE shared key — add a DynamoDB token-bucket or short-TTL response
  cache before broad rollout. See its README. The desktop own-key path is the
  pressure valve meanwhile.

### Optional polish — jb2hubs `metadata.blatDb` hint
Not required (assembly `name` already equals the UCSC db, and hgBlat resolves
bare GenArk accessions). If wanted: emit `assembly.metadata.blatDb` in
`ucsc2jbrowse` config generation and read it in `BlatDialog` via
`getConf(assembly,['metadata','blatDb'])`, falling back to `assembly.name`.

### Dropped — GenArk via dynamic gfServer (was Task 3)
UNNECESSARY: the web CGI resolves bare GenArk accessions statelessly (confirmed
2026-07-02), so one hgBlat path serves main UCSC + GenArk. The desktop-only
`dynablat-01:4040` / `gfClient` socket work is not needed.

## Key source references
- IGV (java, model): `~/src/vendor/igv/src/main/java/org/igv/util/blat/BlatClient.java`
- igv.js (current, master via raw.githubusercontent): `js/blat/blatClient.js`,
  `js/blat/blatTrack.js` (db=ucscID + TODO), `js/ucsc/hub/hub.js` (parses hub
  `blat` prop), `js/genome/genome.js` (ucscID fallback map).
- jbrowse: `plugins/config/src/FromConfigAdapter`, `plugins/grid-bookmark/src/index.ts`
  (appendToMenu('Tools',...) pattern), `packages/product-core/src/Session/*Tracks.ts`.

See memory [[project-blat-plugin-ucsc-captcha]] for the condensed version.
