import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

import config from './nextstrain_zika.json'

export default function NextstrainZika() {
  const { assembly, tracks, defaultSession, location } = config
  const [state] = useState(() =>
    createViewState({ assembly, tracks, defaultSession, location }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
