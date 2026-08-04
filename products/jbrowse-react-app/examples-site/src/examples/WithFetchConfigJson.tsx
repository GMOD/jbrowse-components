import { useEffect, useState } from 'react'

import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { JBrowseApp, createViewState, loadPlugins } from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

// The config's URIs are relative to where it lives. addRelativeUris tags each
// with a baseUri so JBrowse resolves them against that directory at load time.
//
// A config.json may also name plugins. Unlike JBrowse Web, the embedded app
// doesn't fetch those for you — createViewState is synchronous and fetching is
// not — so hand config.plugins to loadPlugins and pass the result back in. Its
// baseUri does for plugin urls what addRelativeUris does for data urls: a
// config elsewhere names them relative to itself, not to your app.
const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

export default function WithFetchConfigJson() {
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const response = await fetch(configUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching config ${configUrl}`)
      }
      const config = await response.json()
      addRelativeUris(config, new URL(configUrl))
      const plugins = await loadPlugins(config.plugins ?? [], {
        baseUri: configUrl,
      })
      setState(createViewState({ config, plugins }))
    })()
  }, [])

  return state ? <JBrowseApp viewState={state} /> : null
}
