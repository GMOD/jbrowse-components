import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

const ViewWithErrorHandling = observer(function ViewWithErrorHandling({
  state,
}: {
  state: ViewModel
}) {
  const error = state.session.view.error
  if (error) {
    return <ErrorMessage error={error} />
  }
  return <JBrowseLinearGenomeView viewState={state} />
})

export const WithInit = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Hello',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'ctgA:10000-20000',
            assembly: 'volvox',
            tracks: ['volvox_test_vcf'],
          },
        },
      },
    }),
  )
  return (
    <div>
      <ViewWithErrorHandling state={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInit.tsx">
        Source code
      </a>
    </div>
  )
}
