`@jbrowse/react-app2` embeds the **full JBrowse 2 application** — menu bar, view
manager, drawer widgets, every view type — in a React tree. For a single linear
track view with no app chrome, the lighter
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/) fits
better.

`assemblies`, `tracks` and `views` go straight to `<JBrowse>` as props: no
`createViewState` call, no nested `config` object to hand-assemble. The simplest
assembly entry is a name and a sequence URL — JBrowse picks the adapter
(`TwoBitAdapter`, `BgzipFastaAdapter`, `IndexedFastaAdapter`) from the extension
and derives the `.fai`/`.gzi` siblings. Add
`refNameAliases: { uri: '.../aliases.txt' }` when a track's reference names
differ from the sequence's.

**The stylesheet import is required** — without it the view manager's tabs
render unstyled. Import it once anywhere; a build with no CSS loader can link
`node_modules/@jbrowse/react-app2/dist/styles.css` directly.

The props are **initial values, read once on mount**. `assemblies` and `tracks`
use the same format as a JBrowse Web `config.json`, so configs round-trip — but
unlike JBrowse Web the component never auto-fetches one from a URL parameter
(see [Import a config.json](../loading-config/#with-import-config-json)). Each
view's `init` is the same shape JBrowse Web serializes into `?session=spec-…`,
documented under
[URL query parameters](https://jbrowse.org/jb2/docs/urlparams/#session-spec).

`<JBrowse>` also takes `plugins`, `makeWorkerInstance`, `onChange`, and a `ref`
to reach the model after launch. To read or drive the model from outside, use
the unmanaged `createViewState` + `<JBrowseApp>` flow instead.
