// NOTE: deliberately no stylesheet import here. A side-effect CSS import in the
// npm entry point forces every consumer's bundler to have a CSS loader and
// makes this barrel unloadable in Node/SSR entirely (its loader has no CSS
// support) — see mui/mui-x#17427 for that mistake shipped. Consumers import
// '@jbrowse/react-app2/styles.css' instead; the UMD bundle built from
// webpack.ts still inlines it, since a script-tag user can't import anything.
export { default as JBrowseApp } from './JBrowseApp/index.ts'
export { default as JBrowse } from './JBrowse/index.ts'
export type { JBrowseProps, ManagedView } from './JBrowse/index.ts'
// the imperative twin of <JBrowse>, for hosts that don't write JSX (Jupyter
// anywidgets, R htmlwidgets, plain <script> pages). viewsToSession stays
// internal — it exists to keep this and <JBrowse> from drifting, not as API.
export { createApp } from './createApp.ts'
export type { CreateAppOptions, JBrowseAppController } from './createApp.ts'
export { default as createModel } from './createModel.ts'
export { default as createViewState } from './createViewState.ts'
export type { CreateViewStateOptions } from './createViewState.ts'
export type { PluginsUpdate } from './rootModel/rootModel.ts'
export { useCreateViewState } from './useCreateViewState.ts'
// tear down an engine the host built and is discarding — React unmount alone
// leaves its RPC workers and autoruns running
export { destroyViewState } from './destroyViewState.ts'
export { default as loadPlugins } from './loadPlugins.ts'
// serialize the live session to a URL-safe string and back, for hosts that keep
// app state in the address bar
export { decodeSession, encodeSession } from './sessionUrl.ts'
export type { ViewModel } from './createModel.ts'
export type { Config, PluginInput, SessionSnapshot } from './types.ts'
