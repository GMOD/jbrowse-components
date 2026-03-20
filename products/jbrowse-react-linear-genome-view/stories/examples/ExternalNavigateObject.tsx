// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'
const options = [
  {
    name: 'EDEN',
    location: {
      refName: 'ctgA',
      start: 1,
      end: 5000,
      assemblyName: 'volvox',
    },
  },
  {
    name: 'Apple1',
    location: {
      refName: 'ctgA',
      start: 5000,
      end: 10000,
      assemblyName: 'volvox',
    },
  },
]

type ViewState = ReturnType<typeof createViewState>

export const ExternalNavigateObject = () => {
  const [val, setVal] = useState('')
  const [error, setError] = useState<unknown>()
  const { assembly, tracks } = getVolvoxConfig()

  // initialize the state once on startup
  const [viewState] = useState<ViewState>(() =>
    createViewState({
      assembly,
      tracks,
    }),
  )

  useEffect(() => {
    // we can ignore this 'floating promise' because we fully handle it's error lifecycle
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        // try to clear error if any
        setError(undefined)
        const entry = options.find(f => f.name === val)
        if (entry) {
          await viewState.session.view.navToLocations([entry.location])
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [viewState, val])

  return (
    <div>
      <select
        value={val}
        onChange={event => {
          setVal(event.target.value)
        }}
      >
        <option value={''}>Select one</option>
        {options.map(o => (
          <option key={o.name} value={o.name}>
            {o.name} ({JSON.stringify(o)})
          </option>
        ))}
      </select>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseLinearGenomeView viewState={viewState} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ExternalNavigateObject.tsx">
        Source code
      </a>
    </div>
  )
}
