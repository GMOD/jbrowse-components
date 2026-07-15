declare module '@fontsource/roboto'
declare module 'dockview-react/dist/styles/dockview.css'

interface Window {
  // Set by SessionLoader.ts to allow overriding config path via embed
  __jbrowseConfigPath?: string
  // When set, appends a ?rand= cache-buster to the fetched config URL
  __jbrowseCacheBuster?: boolean
  // Debug globals exposed for browser console access
  JBrowseRootModel?: unknown
  JBrowseSession?: unknown
  // MST utilities exposed for testing (temporary)
  getSnapshot?: unknown
  resolveIdentifier?: unknown
}
