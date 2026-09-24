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
export type {
  AsyncViewStateOptions,
  ViewStateOptions,
} from './createViewState.ts'
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
// pin the page to one rendering backend, jbrowse-web's `?renderer=` for a host
// with no URL of ours; page-wide, and read by canvases mounted after the call
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
