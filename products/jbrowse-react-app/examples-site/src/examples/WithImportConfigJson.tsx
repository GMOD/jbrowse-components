import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { JBrowseApp, useCreateViewState } from '@jbrowse/react-app2'

import config from '../volvox-config.json' with { type: 'json' }

// The config's URIs are relative to where it was downloaded from. addRelativeUris
// tags each with a baseUri so JBrowse resolves them against that directory.
const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'
addRelativeUris(config, new URL(configUrl))

export default function WithImportConfigJson() {
  // `useCreateViewState`, not `useState(() => createViewState(…))`: React
  // double-invokes a state initializer under StrictMode and throws the second
  // result away, which for an engine is a whole orphaned worker pool per mount.
  // undefined for the frame in which the engine is still being built — the
  // view and display types the config's session names load first
  const state = useCreateViewState({ config })
  return state ? <JBrowseApp viewState={state} /> : null
}
