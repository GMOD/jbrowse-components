declare module 'hic-straw'
declare module '@fontsource/roboto'

interface Window {
  // Set by SessionLoader.ts to allow overriding config path via embed
  __jbrowseConfigPath?: string
  // Debug globals exposed for browser console access
  JBrowseRootModel?: unknown
  JBrowseSession?: unknown
}
