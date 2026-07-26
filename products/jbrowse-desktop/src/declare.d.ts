declare module '@fontsource/roboto'
declare module 'dockview-react/dist/styles/dockview.css'

interface Window {
  // Debug/automation handles, the same pair jbrowse-web publishes: the console,
  // ErrorMessageStackTraceDialog (which reads JBrowseSession for the version and
  // rpc driver in a bug report), and the screenshot harness, which asserts on the
  // model instead of scraping the header for the view's position.
  JBrowseRootModel?: unknown
  JBrowseSession?: unknown
  // MST utilities exposed for testing (temporary)
  getSnapshot?: unknown
  resolveIdentifier?: unknown
  // Node's require(), available in the renderer because the window is created
  // with nodeIntegration/contextIsolation:false (see electron/window.ts). There
  // is no preload script — this is the real Node require, not a bridged subset.
  require: NodeJS.Require
}
