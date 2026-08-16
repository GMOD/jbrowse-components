---
name: handoff-desktop-audit
description: What a structural audit of jbrowse-desktop found, which fixes landed, and the four workstreams that remain — the contextIsolation finish, the plugin IPC boundary, the BLAT bridge, and export-to-web durability. Read before starting any of the four; each entry names its first move and what is already decided.
---

# Handoff: the jbrowse-desktop audit

An end-to-end read of `products/jbrowse-desktop` — main process, renderer, the
BLAT bridge, the export path. Six fixes landed as one commit. Four things left
are too large for that, and this file is what keeps them from being re-derived.

## What landed

One commit, `fix(desktop): repair the IPC channel guard and the four gaps it hid`.
The reasoning is in the message; the short version:

- **The `INVOKABLE_CHANNELS` exhaustiveness guard never checked anything.**
  `const _: UnlistedChannel[] = []` passes for every `UnlistedChannel`, because
  an empty array literal is assignable to any array type. It is now a `never`
  constraint, which errors naming the channel.
- **It was hiding `setSessionOpen` and `sessionFlushed`**, both invoked by the
  renderer and neither listed. See "the flip is not one flag" below for why that
  mattered more than it looks.
- `saveSession` skips a write whose bytes are already on disk, leaves
  `recent_sessions.json` alone when only a row's `updated` would move, and drops
  the indent from autosaves.
- `writeFileAtomic` flushes before the rename.
- `reset` clears `nameIndicesDir`, which nothing had ever pruned.
- The OAuth redirect is matched as origin + path rather than by prefix.

## The four that remain

Ordered by what blocks what. (1) is the one the other three keep running into;
(2) is a prerequisite for doing (1) without breaking third-party plugins, and is
worth doing on its own merits either way.

### 1. Finish the contextIsolation migration

`reference/DESKTOP_CONTEXT_ISOLATION.md` holds the plan and the probe results,
and is still right about the shape of the work. Two corrections and one addition
from this audit are folded into it — read that file, not this section, for the
sequencing. What belongs here is why it has not moved:

**The flip is not one flag, and the failure mode is silence.** Every renderer
path that reaches the main process has to be an allowlisted `invoke` *before* the
flag moves, and nothing today reports one that isn't. The two missing channels
were missing for as long as they have existed; the guard that was supposed to
catch them was inert; and both call sites are `.catch(console.error)`, so the
symptom would have been "closing the window sometimes loses the last second of
work" — a bug nobody would have connected to a security flag.

That is the argument for step 7 of the existing plan (an e2e assertion that the
lockdown holds) being written *first*, not last. It is also the argument for (2):
a bridge whose surface is derived from one list cannot drift from it.

**First move:** the spike named in the existing doc — does the renderer bundle
still contain `require("fs")` once `generic-filehandle2` resolves through its
browser field? Nothing else is verifiable while the renderer will not boot, and
if `electron-renderer` turns out to be load-bearing for the workers, the whole
plan needs rethinking and it is cheap to learn that now.

### 2. Give plugins a sanctioned way to reach the main process

**The typed IPC boundary is not the boundary.** `src/ipc.ts` types all 23
channels and stops the `any` — for callers inside the product. Outside it, four
places hand-roll `window.require('electron')` and restate the contract with
casts:

| | reaches | via |
| --- | --- | --- |
| `plugins/blat/src/desktopBlat.ts` | `blatFetch`, `openBlatChallenge` | cast |
| `plugins/authentication/src/OAuthModel/model.tsx` | `openAuthWindow` | cast |
| `packages/core/src/ui/FileSelector/LocalFileChooser.tsx` | `promptOpenLocalFile` | cast |
| `packages/core/src/util/index.ts` (`fileToLocation`) | **`webUtils.getPathForFile`** | `@ts-ignore` |

Three consequences, in increasing order of cost:

- Change a channel's return type in `channelTypes.ts` and all four still
  compile. They fail at runtime.
- Two of the 23 channels exist only for a plugin that lives outside the product
  and cannot import the product's types. That is what forced the cast.
- **The last row is not a channel at all.** `webUtils` is a distinct Electron
  API, and `requireShim.ts` exposes `ipcRenderer.invoke` and nothing else — so
  the shim's central claim, that "everything that crosses to the main process is
  an `ipcRenderer.invoke`, so that one method is the whole bridge", is false as
  written. Drag-and-drop opening a local file breaks the moment the flag moves,
  and it breaks in `@jbrowse/core`, not in desktop.

**The design, as far as it is decided:** the type belongs in `@jbrowse/core`
(where the callers are), the implementation in desktop, and the shim's allowlist
should be derived from the same declaration rather than restated. A plugin asks
for the bridge and gets `undefined` off desktop, which is the check
`isElectron` is standing in for today and doing badly — it is a userAgent sniff
that stays true after the flip (blocker 3 in the reference doc).

**Open, and worth deciding before writing any of it:** whether the bridge goes
through `ReExports` or through the plugin manager. `ReExports` is the
established plugin API surface, but per `reference/PLUGIN_ABI_STABILITY.md` a
removal there fails quietly — and this surface is one we would be adding to,
then wanting to constrain later. Weigh that against the plugin manager, which
plugins already hold.

**Do not start with `webUtils`.** Decide the shape on `blatFetch`, which has one
consumer and a test, then move the other three.

### 3. Harden the BLAT bridge

`electron/ipc/blatHandlers.ts` is not a BLAT client; it is a general-purpose
authenticated request proxy. Renderer-supplied URL, renderer-supplied body, no
scheme check, no host allowlist, `credentials: 'include'` on the app's **default**
session, and the full response body returned. `openBlatChallenge` is the same
shape one layer up: an arbitrary renderer URL opened in a `BrowserWindow` that
shares that cookie jar, with no `will-navigate` or `setWindowOpenHandler` guard.

Today this is not an escalation — the renderer already has Node. It becomes the
boundary the moment (1) lands, which is exactly the trap the reference doc's step
5 describes: locking the renderer while leaving this reachable changes the
payload, not the outcome.

**The one design decision that is not obvious.** A host allowlist cannot be
static: the dialog's server field is how someone runs their own proxy or their
own `gfServer`, and that is a feature. What *can* be constrained is the cookie
jar. Give the challenge window and `blatFetch` a named partition
(`session.fromPartition('blat')`) instead of the default session. The
`cf_clearance` cookie a solve leaves behind still attaches to the BLAT request —
which is the entire point of routing through main — while a POST to any other
host stops carrying the app's OAuth cookies, because they are no longer in the
same jar. That removes the interesting half of the capability without touching
what the feature does.

Then the ordinary hygiene, none of it contentious: require http(s), reject
credentials in the URL, cap the response size, and give it a timeout plus an
`AbortSignal`. **There is no cancellation anywhere in this path today** — the
dialog's Cancel closes the UI and the POST keeps running in main with nowhere to
land.

**First move:** the partition, alone, with `liveBlat.test.ts`'s header read
first — it explains why that test is skipped unconditionally, which is the
constraint on how any of this gets verified.

### 4. Export-to-web durability

`planWebExport` itself is sound — the base-config diff, the assembly-collision
handling, the re-run of portability over the shipped session are all right. The
problems are around it, and both are about links outliving the moment they were
made. These are artifacts: papers, supplements, emails.

**No URL length guard anywhere.** Long link is the default mode, and a
self-contained export carries its own assemblies and tracks. Real autosaves on
this machine run 1.1–1.6 MB, and deflate + base64 of one is still hundreds of KB
in a hash fragment that then goes through `window.open` and the clipboard.
Nothing measures the assembled URL and nothing warns. This is the most likely
way export-to-web fails in the field, and it fails mutely.

The fix is small and mostly a UI decision: measure the assembled URL in
`ExportToWebDialog`, and past a threshold say so and steer to the short link,
which is already the mode that solves it. Pick the threshold deliberately —
`buildWebExportUrl`'s hash choice already dodges the request-line limit, so what
is left is the browser's own address-bar and `window.open` ceilings, which are
what need measuring rather than guessing.

**The link points at `latest`.** `DEFAULT_WEB_BASE_URL` is
`https://jbrowse.org/code/jb2/latest/`, and nothing records the version that
produced the link or pins the hosted base config it diffed against. A session
encoded today opens against an unknown future build, and the recipient can get a
third state of the base config. The cheap half — stamping the producing version
into the link so a future loader can at least *say* what it is reading — is worth
doing even if pinning the deployment is not the maintainers' call to make here.

## Two smaller things, deliberately not done

- **The autosave interval is still 1 s.** The landed fixes cut what each tick
  costs; they do not change how often it fires, and `autorun`'s `delay` is a
  throttle rather than a debounce, so it fires for as long as anything changes —
  panning included. Raising it trades a wider data-loss window for proportionally
  less IO, and that window is much less load-bearing than it was: `closeGuard`
  now flushes on window close, and the Exit, return-to-start-screen and
  session-swap paths all flush too. **It is a judgment call about the user's
  data, so it is Colin's, not the implementer's.** An interval that scales with
  the serialized size is the version worth proposing.
- **`autoUpdater.quitAndInstall` against `closeGuard` is untested.**
  `quitAndInstall` closes the window; the close guard `preventDefault`s that and
  re-issues `app.quit()` after the flush. Whether the installer survives being
  cancelled and re-quit is not covered by `closeGuard.test.ts` or the packaged-app
  harness. Reason about it as far as electron-updater's source and then test it —
  the failure mode is "the update silently does not install", which no user would
  report as a bug.
