import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { JBrowseApp, useCreateViewState } from '@jbrowse/react-app2'

import config from '../volvox-config.json' with { type: 'json' }

const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'
addRelativeUris(config, new URL(configUrl))

export default function WithImportConfigJson() {
  const state = useCreateViewState({ config })
  return state ? <JBrowseApp viewState={state} /> : null
}
