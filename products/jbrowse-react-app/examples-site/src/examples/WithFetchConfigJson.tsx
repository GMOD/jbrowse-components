import { useEffect, useState } from 'react'

import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import {
  JBrowseApp,
  createViewState,
  destroyViewState,
  loadPlugins,
} from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

export default function WithFetchConfigJson() {
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    const mount = {
      unmounted: false,
      engine: undefined as ViewState | undefined,
    }
    void (async () => {
      const response = await fetch(configUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching config ${configUrl}`)
      }
      const config = await response.json()
      addRelativeUris(config, new URL(configUrl))
      const plugins = await loadPlugins(config.plugins ?? [], {
        baseUri: configUrl,
      })
      if (mount.unmounted) {
        return
      }
      mount.engine = createViewState({ config, plugins })
      setState(mount.engine)
    })()
    return () => {
      mount.unmounted = true
      if (mount.engine) {
        destroyViewState(mount.engine)
      }
    }
  }, [])

  return state ? <JBrowseApp viewState={state} /> : null
}
