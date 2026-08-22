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
export type {
  AssemblyInput,
  LocalFileInput,
  ResolvedAssemblies,
  SessionObservers,
  ViewLocation,
} from './types.ts'
// `assemblies` takes configs; this turns hub names ('hg38'), sequence URIs and
// hub configs into them, so the app takes the same vocabulary the single-view
// product does. Kept out of createApp deliberately — see its doc comment.
export { resolveAssemblies } from '@jbrowse/product-core'
export { default as createModel } from './createModel.ts'
export {
  default as createViewState,
  createViewStateAsync,
} from './createViewState.ts'
export type { CreateViewStateOptions } from './createViewState.ts'
export type { PluginsUpdate } from './rootModel/rootModel.ts'
export { useCreateViewState } from './useCreateViewState.ts'
// Pin the page to one rendering backend — the same switch jbrowse-web's
// `?renderer=` throws, and the embedded host's only way to throw it, since there
// is no URL of ours to put a parameter in. It is the host that can make this
// call and we cannot: the browser's WebGL context budget is per *page*, and the
// rest of that page — another engine, a map, a plot — is code JBrowse never
// sees. This product spends more of that budget than the single-view one, since
// every open view holds its own canvases.
//
// Page-wide rather than per view state, because it pins one physical device;
// two engines disagreeing means the last caller wins. Call it before the first
// view renders. A canvas's context kind is permanent, so an override arriving
// afterwards leaves already-mounted canvases on the backend they took.
export { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
export type { GpuOverride } from '@jbrowse/render-core/gpuDevice'
// tear down an engine the host built and is discarding — React unmount alone
// leaves its RPC workers and autoruns running
export { destroyViewState } from './destroyViewState.ts'
export { default as loadPlugins } from './loadPlugins.ts'
// serialize the live session to a URL-safe string and back, for hosts that keep
// app state in the address bar; getSessionSnapshot is the plain-JSON twin, for
// hosts that move snapshots rather than URLs (a notebook kernel, an R session)
export {
  decodeSession,
  encodeSession,
  getSessionSnapshot,
} from './sessionUrl.ts'
export type { ViewModel } from './createModel.ts'
export type { Config, PluginInput, SessionSnapshot } from './types.ts'
