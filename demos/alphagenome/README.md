# alphagenome fixture

The session the
[AlphaGenome tutorial](../../website/docs/tutorials/alphagenome.md) opens on,
and the live link under its session fence
(`config=https://jbrowse.org/demos/alphagenome/config.json`).

It renders the third-party
[jbrowse-plugin-alphagenome](https://github.com/cmdcolin/alphagenome_browser)
(three adapters, a view-menu dialog and a variant right-click item), which is
not bundled in JBrowse Web. Data-free: hg38 comes from UCSC, the genes from
`jbrowse.org/genomes`, and the variant track is a 2 KB BED beside the demo.

**No AlphaGenome track is in here, and none can be.** A prediction is stored as
a track-major float array that the browser reads by HTTP range, addressed
through a presigned URL that expires within the hour, so a track config is only
valid for the session that built it. The plugin's own panel is the only thing
that can add one, which is what the tutorial walks through.

`umdUrl` **is pinned to a content-addressed prefix**
(`demos/alphagenome-plugin/<hash>/`), which the plugin's `pnpm betabuild` writes
alongside the unversioned entry point and prints at the end. The plugin lives in
another repo, so an unpinned url here means a deploy changes what this fixture
loads with no commit here to attribute it to. Bumping the pin is a one-line
reviewable diff.

The unversioned url stays current, and it is what the tutorial tells a reader to
install: a visitor following the docs wants the build the docs just described.

The config is served **same-origin** with the app: the docs' live link opens
`CODE_BASE` (`jbrowse.org/code/jb2/main/` by default), and this config sits at
`jbrowse.org/demos/alphagenome/`. That is what keeps jbrowse-web's cross-origin
plugin-trust dialog out of the way — `SessionLoader.ts` raises it only when the
_config_ url's origin differs from the app's
(`configUri.origin !== window.location.origin`), not the plugin's, which is
otherwise unchecked against the plugin store since its
`demos/alphagenome-plugin/` url isn't under the trusted `jbrowse.org/plugins/`
prefix. Opening this session from a local dev build (a different origin) would
trip the dialog.

The plugin is UMD rather than ESM, and `plugins[].name` must be `AlphaGenome`
because the loader reads the plugin off the global as `JBrowsePlugin<name>`. It
externalizes everything on `@jbrowse/core/ReExports/list` and takes those at
load time from `globalThis.JBrowseExports`, so it needs no import map and shares
the host's React, MobX and configuration registry.

Predictions come from a service that holds the AlphaGenome API key. The two the
tutorial reads are recorded and stored under stable tokens, so opening this
costs no API quota however many people open it.
