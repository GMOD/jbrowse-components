import { useEffect, useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { addRelativeUris } from '../volvoxConfig.ts'

type ViewState = ReturnType<typeof createViewState>

// The config's URIs are relative to where it lives. addRelativeUris tags each
// with a baseUri so JBrowse resolves them against that directory at load time.
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
      addRelativeUris(config, configUrl)
      setState(createViewState({ config }))
    })()
  }, [])

  return state ? <JBrowseApp viewState={state} /> : null
}
