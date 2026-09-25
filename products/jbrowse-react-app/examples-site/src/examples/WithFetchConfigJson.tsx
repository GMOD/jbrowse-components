import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import {
  JBrowseApp,
  createViewStateAsync,
  loadPlugins,
  useCreateViewState,
} from '@jbrowse/react-app2'

const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

async function build() {
  const response = await fetch(configUrl)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching config ${configUrl}`)
  }
  const config = await response.json()
  addRelativeUris(config, new URL(configUrl))
  const plugins = await loadPlugins(config.plugins ?? [], {
    baseUri: configUrl,
  })
  return createViewStateAsync({ config, plugins })
}

export default function WithFetchConfigJson() {
  const state = useCreateViewState(build)
  return state ? <JBrowseApp viewState={state} /> : null
}
