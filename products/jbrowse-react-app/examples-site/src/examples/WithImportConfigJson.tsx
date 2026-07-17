import { useState } from 'react'

import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import config from '../volvox-config.json' with { type: 'json' }

// The config's URIs are relative to where it was downloaded from. addRelativeUris
// tags each with a baseUri so JBrowse resolves them against that directory.
const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'
addRelativeUris(config, new URL(configUrl))

export default function WithImportConfigJson() {
  const [state] = useState(() => createViewState({ config }))
  return <JBrowseApp viewState={state} />
}
