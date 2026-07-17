declare module '@fontsource/roboto'
declare module 'dockview-react/dist/styles/dockview.css'

interface Window {
  // MST utilities exposed for testing (temporary)
  getSnapshot?: unknown
  resolveIdentifier?: unknown
  // Node's require(), available in the renderer because the window is created
  // with nodeIntegration/contextIsolation:false (see electron/window.ts). There
  // is no preload script — this is the real Node require, not a bridged subset.
  require: NodeJS.Require
}
