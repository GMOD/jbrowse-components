declare module '@fontsource/roboto'
declare module 'dockview-react/dist/styles/dockview.css'

interface Window {
  // Set by SessionLoader.ts to allow overriding config path via embed
  __jbrowseConfigPath?: string
  // When set, appends a ?rand= cache-buster to the fetched config URL
  __jbrowseCacheBuster?: boolean
  // Debug globals for the devtools console; also how browser-tests reach into
  // the live models (see browser-tests/suites). Nothing in the repo imports the
  // MST pair, so a grep reads them as dead — they are used by hand against a
  // running instance, so don't remove them on that evidence.
  JBrowseRootModel?: unknown
  JBrowseSession?: unknown
  getSnapshot?: unknown
  resolveIdentifier?: unknown
}
