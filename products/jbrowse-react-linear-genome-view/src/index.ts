export { default as JBrowseLinearGenomeView } from './JBrowseLinearGenomeView/index.ts'
// the imperative twin of <JBrowseLinearGenomeView>, for hosts that don't write
// JSX (Jupyter anywidgets, R htmlwidgets, plain <script> pages)
export { createLinearGenomeView } from './createLinearGenomeView.ts'
export type {
  CreateLinearGenomeViewOptions,
  LinearGenomeViewController,
  LinearGenomeViewState,
} from './createLinearGenomeView.ts'
export { default as LinearGenomeView } from './LinearGenomeView/index.ts'
export type { LinearGenomeViewProps } from './LinearGenomeView/index.ts'
export { default as createModel } from './createModel/index.ts'
export { default as createViewState } from './createViewState.ts'
// the async twin, for a `session` that came from somewhere else and may name
// display types whose state models are lazily loaded — a session restored from
// a URL is the usual one
export { createViewStateAsync } from './createViewState.ts'
export type { ViewStateOptions } from './createViewState.ts'
// tear down an engine the host built and is discarding — React unmount alone
// leaves its RPC workers and autoruns running
export { destroyViewState } from './destroyViewState.ts'
export { default as loadPlugins } from './loadPlugins.ts'
// serialize the live session to a URL-safe string and back, for hosts that keep
// view state in the address bar; getSessionSnapshot is the plain-JSON twin, for
// hosts that move snapshots rather than URLs (a notebook kernel, an R session)
export {
  decodeSession,
  encodeSession,
  getSessionSnapshot,
} from './sessionUrl.ts'
export { useCreateViewState } from './useCreateViewState.ts'
// Pin the page to one rendering backend — the same switch jbrowse-web's
// `?renderer=` throws, and the embedded host's only way to throw it, since there
// is no URL of ours to put a parameter in. It is the host that can make this
// call and we cannot: the browser's WebGL context budget is per *page*, and the
// rest of that page — another engine, a map, a plot — is code JBrowse never
// sees.
//
// Page-wide rather than per view state, because it pins one physical device;
// two engines disagreeing means the last caller wins. Call it before the first
// view renders. A canvas's context kind is permanent, so an override arriving
// afterwards leaves already-mounted canvases on the backend they took.
export { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
export type { GpuOverride } from '@jbrowse/render-core/gpuDevice'
export type { ViewModel } from './createModel/createModel.ts'
// the assembly vocabulary is product-core's, shared with the multi-view app
export { resolveAssemblies } from '@jbrowse/product-core'
export type {
  AssemblyInput,
  LocalFileInput,
  PluginInput,
  ResolvedAssemblies,
  SessionSnapshot,
} from '@jbrowse/product-core'
