// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'

import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

const options = [
  { name: 'EDEN', location: 'ctgA:1-5,000', assemblyName: 'volvox' },
  { name: 'Apple1', location: 'ctgA:5,000-10,000', assemblyName: 'volvox' },
]

type ViewState = ReturnType<typeof createViewState>

export const ExternalNavigateLocstring = () => {
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
      // try to clear error if any
      setError(undefined)
      const entry = options.find(f => f.name === val)
      if (entry) {
        try {
          await viewState.session.view.navToLocString(
            entry.location,
            entry.assemblyName,
          )
        } catch (e) {
          // good practice: navToLocString is async and can throw, catch error
          // if any
          console.error(e)
          setError(e)
        }
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
            {o.name} ({o.location})
          </option>
        ))}
      </select>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseLinearGenomeView viewState={viewState} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ExternalNavigateLocstring.tsx">
        Source code
      </a>
    </div>
  )
}
