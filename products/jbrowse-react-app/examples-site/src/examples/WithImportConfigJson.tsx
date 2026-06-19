import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import config from '../volvox-config.json' with { type: 'json' }

// The config's URIs are relative to where it was downloaded from. Tag each with
// a baseUri so JBrowse resolves them against that directory at load time.
function addRelativeUris(config: unknown, baseUri: string) {
  if (config !== null && typeof config === 'object') {
    const obj = config as Record<string, unknown>
    if (typeof obj.uri === 'string' && obj.baseUri === undefined) {
      obj.baseUri = baseUri
    }
    for (const value of Object.values(obj)) {
      addRelativeUris(value, baseUri)
    }
  }
}

const configUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'
addRelativeUris(config, configUrl)

export default function WithImportConfigJson() {
  const [state] = useState(() => createViewState({ config }))
  return <JBrowseApp viewState={state} />
}
