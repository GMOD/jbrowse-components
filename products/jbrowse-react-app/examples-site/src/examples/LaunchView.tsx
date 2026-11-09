import { useRef, useState } from 'react'

import { isTrackContainer } from '@jbrowse/core/util/types'
import { JBrowse } from '@jbrowse/react-app2'

import type { ViewModel } from '@jbrowse/react-app2'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const genesTrack = {
  trackId: 'volvox_genes',
  name: 'Volvox genes',
  uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  assemblyNames: ['volvox'],
}

export default function LaunchView() {
  const ref = useRef<ViewModel>(null)
  const [genesAdded, setGenesAdded] = useState(false)

  function run(action: (state: ViewModel) => Promise<unknown>) {
    const state = ref.current
    if (state) {
      action(state).catch((e: unknown) => {
        state.session.notifyError(`${e}`, e)
      })
    }
  }

  return (
    <JBrowse
      ref={ref}
      assemblies={assemblies}
      views={[
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1..50000' },
      ]}
      headerButtons={
        <>
          <button
            type="button"
            disabled={genesAdded}
            onClick={() => {
              run(async ({ jbrowse, session }) => {
                jbrowse.addTrackConf(genesTrack)
                setGenesAdded(true)
                const view = session.views[0]
                if (isTrackContainer(view)) {
                  await view.launchTrack(genesTrack.trackId)
                }
              })
            }}
          >
            Add genes track
          </button>
          <button
            type="button"
            onClick={() => {
              run(({ session }) =>
                session.launchView('LinearGenomeView', {
                  assembly: 'volvox',
                  loc: 'ctgB:1..6000',
                }),
              )
            }}
          >
            Open another view
          </button>
        </>
      }
    />
  )
}
