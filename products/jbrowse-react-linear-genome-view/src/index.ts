export { default as JBrowseLinearGenomeView } from './JBrowseLinearGenomeView/index.ts'
// the imperative twin of <JBrowseLinearGenomeView>, for hosts that don't write
// JSX (Jupyter anywidgets, R htmlwidgets, plain <script> pages)
export { createLinearGenomeView } from './createLinearGenomeView.ts'
export type {
  CreateLinearGenomeViewOptions,
  LinearGenomeViewController,
} from './createLinearGenomeView.ts'
export { default as LinearGenomeView } from './LinearGenomeView/index.ts'
export type { LinearGenomeViewProps } from './LinearGenomeView/index.ts'
export { default as createModel } from './createModel/index.ts'
export { default as createViewState } from './createViewState.ts'
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
export type { ViewModel } from './createModel/createModel.ts'
// the assembly vocabulary is product-core's, shared with the multi-view app
export { resolveAssemblies } from '@jbrowse/product-core'
export type {
  AssemblyInput,
  PluginInput,
  ResolvedAssemblies,
  SessionSnapshot,
} from '@jbrowse/product-core'
