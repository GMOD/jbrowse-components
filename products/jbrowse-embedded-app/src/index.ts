export { createApp, viewsToSession } from './createApp.ts'
export type {
  CreateAppOptions,
  JBrowseAppController,
  ManagedView,
} from './createApp.ts'
// re-exported so hosts load runtime plugins without depending on react-app2
// directly (this is the single entrypoint they wrap)
export { loadPlugins } from '@jbrowse/react-app2'
