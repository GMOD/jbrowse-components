- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?







## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc




## xref dotplot

On the dotplot, if you're zoomed all the way out and then place your mouse near the edge of the plot and scroll to zoom in, the plot "jumps" so the cursor isn't on the same region anymore. At all other zoom levels, the area under the cursor stays smoothly under it when zooming, it's just from the max zoomed out level, and is much more noticeable when the cursor is near the edge of the plot.


## dont do codeql so much ?

## quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping


## some variants escape collapsed

## blat plugin

we could add our plugin to ~/src/jb2plugins/ hub plugin if it helps

  Listed 2 directories, ran 1 shell command

That's the right instinct, and it's the natural payoff of the web-CGI finding. ~/src/jb2plugins/ is your collection of standalone external plugins (esbuild UMD bundle, @jbrowse/core peer dep, published to npm, listed in jbrowse-plugin-list/plugins.json) — and there's already a jbrowse-plugin-ucsc sibling. Now that BLAT is a plain HTTPS call with no electron socket or native binary, it has no reason to live in jbrowse-desktop corePlugins. An external plugin is one artifact that loads in web and desktop via the plugin store — which is exactly the "stop being desktop-only" goal.

What moving it out changes:

- Port plugins/blat/src/* (blatQuery, pslToFeatures, BlatDialog, tests) into a new jbrowse-plugin-blat scaffold copied from jbrowse-plugin-ucsc (esbuild.mjs, tsconfig, peer @jbrowse/core). The core logic is unchanged.
- Drop the electron-specific code entirely — desktopBlat.ts, blatHandlers.ts, the channels.ts additions, the createChallengeWindow solve-window, and the desktop corePlugins.ts/package.json wiring. An external plugin can't do electron IPC cleanly, so this commits us to the proxy-with-apiKey path for CAPTCHA. Which is what we already chose — and note it's required for web anyway, since a browser fetch straight to genome.ucsc.edu is CORS-blocked (the proxy sends the CORS headers too).
- Register it in jbrowse-plugin-list/plugins.json so it shows in the store.

So the sequence of the whole effort simplifies to: build the apiKey proxy → point one external plugin at it → list it. The uncommitted electron/desktop work becomes dead code you can drop (it was a reasonable bet before we knew the web CGI resolves GenArk).

One decision — where the code lands:
- Standalone jbrowse-plugin-blat (my recommendation): clean separation, its own README/release, obvious name in the store.
- Fold into the existing jbrowse-plugin-ucsc: fewer repos, and BLAT is a UCSC feature; also lets it share the proxy/config with the UCSC API plugin.

I lean standalone for discoverability, but folding is defensible if you'd rather keep UCSC things together. Which way do you want it, and should I scaffold the port now (copying the ucsc-api plugin's build setup) — or hold until you've confirmed the headless apiKey curl so the proxy assumption is locked first?
## config overrides

 anything else you would suggest

A few more things worth flagging, roughly in priority order:

1. The actual resolution logic is untested. The tests cover the store round-trip and the isDisplayMode guard, but nothing exercises the behavior that matters: getConf === 'normal' + session default compact ⇒ getter returns compact, and an explicit non-normal config wins. That's the load-bearing line and it has zero coverage. It needs a session+display harness so it's heavier than the store tests — but without it, a refactor of the getter (e.g. the config-layer move) has nothing to catch a regression.

2. Unchecking the box silently changes the track you're looking at. Because the toggle is symmetric now: if a track shows compact only via inheritance and you uncheck "use compact by default," that track reverts to normal in place. Honest, but potentially surprising — the box reads as "set a global default," not "change this track." Worth deciding if that's the feel you want, or if uncheck should leave the current track where it is (which would mean writing an explicit config on it — back to badge territory). I'd lean toward keeping it symmetric and living with the surprise, but it's your call.

3. No central "what have I overridden / reset all" surface. The agent explicitly skipped the Tools → config-defaults ledger. Right now the only way to discover or undo "all tracks compact" is to find a track, open the height submenu, and uncheck. A user who sets it and forgets has no escape hatch and no visibility. Even a tiny read-only list in preferences would close the trapdoor. Not blocking, but the feature feels unfinished without it.

4. Minor DRY: the three mode labels (Normal/Compact/Super-compact) now live in both the radioSubMenu option array and the new displayModeLabels record. Single-source them — derive the radio options from displayModeLabels (or vice versa) so a fourth mode can't drift between the two.

5. Scaling reminder (reinforces the layer point): set/getDisplayTypeDefault(type, slot, value) is generic over slot, but the resolution is hand-written per-slot in a getter. Add height or heightOverride next and you're writing a second sentinel getter with the same leak. That's the concrete cost of keeping resolution in the display; the tracks-getter merge pays for itself the moment there's a second slot.

None of these block trying the current slice for feel. If I were to pick one to do now regardless of the layer decision, it's #1 — lock the current behavior with a test so the eventual move is safe.
