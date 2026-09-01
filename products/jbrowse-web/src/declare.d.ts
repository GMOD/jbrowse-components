declare module '@fontsource/roboto'
declare module 'dockview-react/dist/styles/dockview.css'

interface Window {
  // Both are set by the HOST PAGE in an inline script, never by anything in
  // this repo — grep finds only the reads, which is why they look unused.
  //
  // Read by SessionLoader's resolvedConfigPath, for a deployment whose config
  // lives somewhere other than ./config.json and that doesn't want to say so
  // in every link's ?config=
  __jbrowseConfigPath?: string
  // Read by fetchRemoteConfig: appends a ?rand= cache-buster to the config URL
  // (see docs/config_guides/avoiding_stale_config)
  __jbrowseCacheBuster?: boolean
  // Debug globals for the devtools console; also how browser-tests reach into
  // the live models (see browser-tests/suites). Nothing in the repo imports the
  // MST pair, so a grep reads them as dead — they are used by hand against a
  // running instance, so don't remove them on that evidence.
  JBrowseRootModel?: unknown
  JBrowseSession?: unknown
  getSnapshot?: unknown
  resolveIdentifier?: unknown
  // window.jb is declared in jbApiGlobal.d.ts instead, because naming its type
  // needs an import and an import would make this file a module — which turns
  // the `declare module` lines above into augmentations of those modules
}
