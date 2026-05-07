declare module 'hic-straw'
declare module '@fontsource/roboto'

interface Window {
  // MST utilities exposed for testing (temporary)
  getSnapshot?: unknown
  resolveIdentifier?: unknown
}
