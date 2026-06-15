# Blank Screen Debug Notes — Mac Package Build

## Symptom

After `pnpm package:mac`, the app opens to a blank screen. DevTools shows:

```
main.997aa0eb.js:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
```

## What is confirmed

- The asar archive is correct: `app.asar` contains both `/index.html` and
  `/static/js/main.997aa0eb.js` with valid SHA256 integrity hashes.
- The `index.html` references the JS with a relative path:
  `<script defer="defer" src="static/js/main.997aa0eb.js">`.
- No quarantine extended attributes on `dist/JBrowse 2.app`.
- `electron/window.ts` builds `file://` URL via
  `pathToFileURL(path.join(app.getAppPath(), 'index.html'))` and calls
  `loadURL`. This approach is unchanged from before the webgl-poc branch.

## Best hypothesis (unconfirmed)

The error `main.997aa0eb.js:1 Failed to load resource` is attributed to **line 1
of an already-loaded `main.js`**, meaning `main.js` itself did load but is
failing to fetch a **dynamic chunk**.

Root cause: `publicPath: 'auto'` in webpack 5 detects the public path at runtime
from the script's own URL. For a `<script defer>` tag, `document.currentScript`
is `null` during execution, so webpack falls back to
`getElementsByTagName("script")` to find the script element's `src`. That
resolves to `file:///…/app.asar/static/js/main.997aa0eb.js`. Webpack then strips
the filename to get public path `file:///…/app.asar/static/js/`.

But the **chunkFilename** already includes the `static/js/` subdirectory:

```
chunkFilename: 'static/js/[name].[contenthash:8].chunk.js'
```

So when webpack loads a chunk it computes:

```
publicPath + chunkFilename
= "file:///…/app.asar/static/js/" + "static/js/1001.chunk.js"
= "file:///…/app.asar/static/js/static/js/1001.chunk.js"   ← double prefix!
```

That path does not exist → `ERR_FILE_NOT_FOUND`.

This bug only surfaces in the packaged Electron `file://` context because:

- In HTTP mode (dev server) the URL `http://localhost:3000/static/js/...` also
  double-prefixes but the server returns the right thing anyway (webpack dev
  server serves from memory with proper routing).
- Alternatively the web build doesn't reproduce if it hasn't been packaged and
  opened via `file://`.

## Suggested fix

Change `output.publicPath` in `webpack/config/webpack.config.ts` from `'auto'`
to `'./'`. With `publicPath: './'`:

- `HtmlWebpackPlugin` injects `<script src="static/js/main.js">` (relative,
  already the case).
- Chunk URL = `'./'` + `'static/js/1001.chunk.js'` =
  `'./static/js/1001.chunk.js'`, resolved relative to the **document** URL →
  `file:///…/app.asar/static/js/1001.chunk.js` ✓

One-line diff in `webpack/config/webpack.config.ts`:

```diff
-      publicPath: 'auto',
+      publicPath: './',
```

After changing, rebuild and repackage:

```
pnpm build && pnpm package:mac
```

### Verification step

Open the packaged app; open DevTools (Cmd+Option+I or via menu); network tab
should show all `static/js/*.chunk.js` requests succeeding.

## Alternative approach

If `publicPath: './'` breaks anything (e.g. the web product at a sub-path),
consider making it desktop-specific in `scripts/config.ts`:

```ts
config.output!.publicPath = './'
```

and keeping `'auto'` in the shared config for the web build.

## Files touched during investigation

- `electron/window.ts` — added then removed a temporary debug log (no net
  change)
- `build/package.json` — created then deleted a temp test file (no net change)

The history is conclusive: until commit ae89a2f7ad (your webgl-poc
simplification), desktop used publicPath: './' (originally from CRA's homepage:
"./"). That commit also removed InlineChunkHtmlPlugin so the webpack runtime now
lives inside main.js instead of inlined into HTML — which is what made 'auto'
start misbehaving in the file:// asar context.

The previous agent's "double prefix" theory isn't quite right (the runtime
computes file:///…/static/js/../../ which would normalize correctly under
script.src), but their FIX is the historically-proven setting for desktop. I'll
apply it desktop-only as you requested.

⏺ Update(products/jbrowse-desktop/scripts/config.ts) ⎿  Added 1 line 13
'../../../node_modules/generic-filehandle2/dist/index.js', 14 ), 15 } 16 +
config.output!.publicPath = './' 17 return config 18 }

⏺ Now let me verify the favicon/manifest template substitution will work right
with './':

Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Applied the fix. Set config.output!.publicPath = './' desktop-only in
products/jbrowse-desktop/scripts/config.ts:16. Web build stays on 'auto' so its
sub-path / webworker handling is untouched.

- The "double prefix" theory isn't quite right — runtime publicPath under 'auto'
  is file:///…/app.asar/static/js/../../, which the browser would normalize
  correctly when joined with static/js/X.chunk.js.
- The real picture: until commit ae89a2f7ad (this branch), the runtime chunk was
  extracted as a separate file and inlined into HTML by InlineChunkHtmlPlugin.
  That commit removed the inline plugin AND moved desktop from its historical
  publicPath: './' (via CRA homepage: "./") to 'auto'. With the runtime now
  bundled into main.js and 'auto' running in a file:// asar context, public path
  detection produces a URL that Electron's asar layer doesn't resolve correctly.
- A secondary visible symptom of 'auto' in desktop: index.html rendered <%=
  htmlWebpackPlugin.options.publicPath %> literally as auto, producing broken
  autofavicon.ico / automanifest.json references. With './' these become
  ./favicon.ico / ./manifest.json correctly.

Next step (manual, on your side):

pnpm build && pnpm package:mac

Then open the unzipped JBrowse 2.app and verify DevTools network tab shows
static/js/\*.chunk.js requests succeeding. If it works, you can rm
products/jbrowse-desktop/BLANK_SCREEN_DEBUG.md
products/jbrowse-desktop/electron.js index.html (those are the leftover
handoff/debug artifacts in your git status).

✻ Cooked for 6m 39s

❯ anything else you would suggest

⏺ A few small follow-ups worth considering:

1. Fix the template trap. products/jbrowse-desktop/public/index.html lines 8 and
   15 use <%= htmlWebpackPlugin.options.publicPath %>favicon.ico. That's what
   produced the broken autofavicon.ico / automanifest.json under 'auto'. The web
   template just uses bare favicon.ico / manifest.json (they resolve relative to
   index.html either way). I'd remove the substitution from the desktop template
   so this can't bite again if publicPath ever changes:

Read 1 file (ctrl+o to expand)

⏺ 2. Verify the dev server still works after the change — pnpm start in
products/jbrowse-desktop. With publicPath: './' and an Electron BrowserWindow
pointing at http://localhost:3000, chunk URLs become relative to the document,
which dev-server handles fine; but a 30-second sanity check is worth it before
you commit.

3. Stale homepage check. Worth a quick grep '"homepage"'
   products/jbrowse-desktop/package.json — if "homepage": "./" is still in there
   from CRA days, it does nothing now (the build no longer reads it) and could
   be deleted for clarity, OR left as a passive hint that desktop wants relative
   URLs.

4. The three untracked files (index.html, BLANK_SCREEN_DEBUG.md,
   products/jbrowse-desktop/electron.js) are all debug leftovers — safe to
   delete after you confirm the packaged app loads. The 926KB electron.js in
   products/jbrowse-desktop/ is particularly worth removing since it sits next
   to the real electron/ source dir and could confuse later.

5. Add a smoke test to CI eventually — pnpm package:mac + headless launch +
   assert the renderer doesn't blank. Out of scope here, but this regression
   slipped through because nothing exercises the packaged artifact.

Want me to apply (1) now?

✻ Baked for 26s

❯ i am not able to start dev server i think i got at a minimum this error:
(anonymous) @ node:electron/js2c/renderer_init:2
%3C%=%20htmlWebpackPlugin.options.publicPath%20%%3Emanifest.json:1 Failed to
load resource: the server responded with a status of 400 (Bad Request) and is a
blank page

⏺ That confirms suggestion #1 isn't optional — it's actively broken in dev mode
too. The template substitution <%= htmlWebpackPlugin.options.publicPath %> isn't
being evaluated at all in dev (probably because HtmlWebpackPlugin doesn't fill
options.publicPath when output is the default dev path), so the literal <%=...%>
is hitting the dev server as a URL → 400.

Fixing the template now — bare relative paths work in both dev and packaged
builds (proven by jbrowse-web doing exactly this):

⏺ Update(products/jbrowse-desktop/public/index.html) ⎿  Added 2 lines, removed 8
lines 3 <head> 4 <meta charset="utf-8" /> 5 <base target="_blank" /> 6 - <link
7 - rel="shortcut icon" 8 - href="<%= htmlWebpackPlugin.options.publicPath
%>favicon.ico" 9 - /> 6 + <link rel="shortcut icon" href="favicon.ico" /> 7

<meta name="viewport" content="width=device-width, initial-scale=1" /> 8
<meta name="theme-color" content="#000000" /> 9
<meta name="description" content="A fast and flexible genome browser" /> 13 -
<link 14 - rel="manifest" 15 - href="<%= htmlWebpackPlugin.options.publicPath
%>manifest.json" 16 - /> 10 + <link rel="manifest" href="manifest.json" /> 11
<title>JBrowse</title> 12 </head> 13 <body>

⏺ Now let me check why dev mode might also blank — the favicon 400 alone
wouldn't blank the page, so there's likely a deeper dev-server interaction with
'./':

Read 1 file (ctrl+o to expand)

⏺ I need to make publicPath: './' apply only to the production build — dev mode
needs 'auto' because webpack-dev-server's middleware publicPath comes from
output.publicPath and './' breaks URL matching there. Let me look at how the
desktop build invokes the config:

Read 2 files (ctrl+o to expand)

⏺ Update(products/jbrowse-desktop/scripts/config.ts) ⎿  Added 3 lines, removed 1
line 13 '../../../node_modules/generic-filehandle2/dist/index.js', 14 ), 15 }
16 - config.output!.publicPath = './' 16 + if (process.env.NODE_ENV ===
'production') { 17 + config.output!.publicPath = './' 18 + } 19 return config 20
}

⏺ Made it production-only. Summary of where we land:

products/jbrowse-desktop/scripts/config.ts:

- Dev (pnpm start): keeps 'auto' — webpack-dev-server's middleware needs that
  for URL matching on http://localhost:3000.
- Prod (pnpm build): sets './' — the historically-correct setting for the
  packaged file:// asar context.

products/jbrowse-desktop/public/index.html:

- Removed the <%= htmlWebpackPlugin.options.publicPath %> substitution from
  favicon and manifest links — those were unprocessed in dev (producing the 400
  you just saw) and rendered as literal auto in the prior prod build. Bare
  favicon.ico / manifest.json resolve correctly relative to index.html in both
  contexts (this is what jbrowse-web already does).

To test:

1. pnpm start in products/jbrowse-desktop — page should now render and no <%=
   ... %> URL in the network tab.
2. pnpm build && pnpm package:mac — packaged app should open without the blank
   screen.

✻ Cooked for 1m 8s

❯ this appeared to have worked. is there anything else you would suggest? one
this is that the start screen in products/jbrowse-desktop launches browser which
is not desirable. I am also curious why this issue suddenly 'appeared'. was this
just because we are testing our local zip file build or what?

⏺ Glad it works. Two answers:

1. Stop the browser from opening on pnpm start

webpack/scripts/start.ts:56 has open: true. For jbrowse-web that's the right
default (you want a browser tab); for desktop you want Electron to be the only
client. I'd make it environment-gated:

Searched for 1 pattern, read 1 file (ctrl+o to expand) ⎿  Interrupted · What
should Claude do instead?

❯ i think there is an issue in the app too, i am not sure publicPath ./ is good
in desktop either. i tested the actual loading of tracks which loads webworker
scripts, and it said: WebWorkerRpcDriver.ts:25 [WebWorker RPC Error] Object
(anonymous) @ WebWorkerRpcDriver.ts:25 importScripts chunk loading:26 Uncaught
NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope': The
script at
'file:///Users/colin/src/jbrowse-components/products/jbrowse-desktop/dist
/JB…app/Contents/Resources/app.asar/static/js/static/js/6533.5d60ce6b.chunk.js'
failed to load. at i.f.i (importScripts chunk loading:26:1) at ensure chunk:6:1
at Array.reduce (<anonymous>) at i.e (ensure chunk:5:1) at i.x (startup chunk
dependencies:3:1) at startup:2:1 at startup:2:1

⏺ Good catch — this confirms the user's instinct was right. The fix needs a
different approach because './' works for the main thread (resolves against
index.html) but BREAKS for workers (resolves against the worker's own URL in
static/js/, producing the static/js/static/js/... double prefix you saw).

Let me think about this carefully. With 'auto':

- Main thread: webpack detects publicPath from main.js's <script> src →
  file:///…/app.asar/static/js/ + ../../ → normalizes to file:///…/app.asar/ ✓
- Worker: webpack detects publicPath from self.location →
  file:///…/app.asar/static/js/ + ../../ → normalizes to file:///…/app.asar/ ✓

So 'auto' SHOULD work for both. The fact that main.js failed in the packaged
build but works in dev suggests Electron's asar handler may be failing on ..
normalization in file:// URLs. Let me check the failing-chunk URL pattern in a
different way:
