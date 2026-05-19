declare module 'hic-straw'
declare module '@fontsource/roboto'
declare module 'dockview/dist/styles/dockview.css'

interface Window {
  // MST utilities exposed for testing (temporary)
  getSnapshot?: unknown
  resolveIdentifier?: unknown
  // injected by Electron preload — Node.js's require() in the renderer
  require: NodeJS.Require
}
