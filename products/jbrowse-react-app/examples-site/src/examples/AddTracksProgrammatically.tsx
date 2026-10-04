import { useRef, useState } from 'react'

import { JBrowse } from '@jbrowse/react-app2'

import type { ViewModel } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const genesTrackConf = {
  trackId: 'volvox_genes',
  name: 'Volvox genes',
  uri: `${base}/volvox.sort.gff3.gz`,
  assemblyNames: ['volvox'],
}

export default function AddTracksProgrammatically() {
  const ref = useRef<ViewModel>(null)
  const [added, setAdded] = useState(false)

  async function addTrack() {
    const state = ref.current
    if (state) {
      state.jbrowse.addTrackConf(genesTrackConf)
      await state.session.views[0]?.launchTrack('volvox_genes')
      setAdded(true)
    }
  }

  return (
    <div>
      <button
        disabled={added}
        onClick={() => {
          void addTrack()
        }}
      >
        {added ? 'Genes track added' : 'Add genes track'}
      </button>
      <JBrowse
        ref={ref}
        assemblies={assemblies}
        tracks={[]}
        sessionName="Programmatic tracks"
        views={[
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
          },
        ]}
      />
    </div>
  )
}
