import { useRef } from 'react'

import { assembly, bookmarks, tracks } from './managedExampleConfig.ts'
import { LinearGenomeView } from '../src/index.ts'

import type { ViewModel } from '../src/index.ts'

export default {
  title: 'LinearGenomeView (managed)/Imperative escape',
  component: LinearGenomeView,
}

// a ref to the live engine lets external buttons navigate the view, without
// the parent ever calling createViewState
function ManagedWithImperativeEscapeRender() {
  const ref = useRef<ViewModel>(null)
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              ref.current?.session.view
                .navToLocString(b.loc)
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={tracks}
        init={{ loc: 'chr1:11,106,077-11,261,675' }}
      />
    </div>
  )
}

export const ManagedWithImperativeEscape = {
  render: ManagedWithImperativeEscapeRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useRef } from 'react'
import {
  LinearGenomeView,
  type ViewModel,
} from '@jbrowse/react-linear-genome-view2'

// assembly + tracks defined as in the Basic example

const bookmarks = [
  { label: 'region A', loc: 'chr1:11,106,077-11,261,675' },
  { label: 'region B', loc: 'chr2:20,000..25,000' },
]

function App() {
  const ref = useRef<ViewModel>(null)
  return (
    <div>
      {bookmarks.map(b => (
        <button
          key={b.loc}
          onClick={() => {
            ref.current?.session.view.navToLocString(b.loc).catch(console.error)
          }}
        >
          {b.label}
        </button>
      ))}
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={tracks}
        init={{ loc: 'chr1:11,106,077-11,261,675' }}
      />
    </div>
  )
}`,
      },
    },
  },
}
