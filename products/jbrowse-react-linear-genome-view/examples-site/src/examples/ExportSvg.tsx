import { useRef, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  LinearGenomeView,
  type ViewModel,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

export default function ExportSvg() {
  const ref = useRef<ViewModel>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>()

  // exportSvg is an async action on the view model — it renders every track
  // through the SVG code path and hands the result to FileSaver. format 'png'
  // rasterizes the same markup. See #action-exportsvg in the docs below.
  function download(format: 'svg' | 'png') {
    setBusy(true)
    setError(undefined)
    Promise.resolve(
      ref.current?.session.view.exportSvg({
        filename: `volvox.${format}`,
        format,
      }),
    )
      .catch(setError)
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          disabled={busy}
          style={{ marginRight: 8 }}
          onClick={() => {
            download('svg')
          }}
        >
          Export SVG
        </button>
        <button
          disabled={busy}
          onClick={() => {
            download('png')
          }}
        >
          Export PNG
        </button>
        {busy ? ' Rendering…' : null}
      </div>
      {error ? <ErrorBanner error={error} /> : null}
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={tracks}
        init={{ loc: 'ctgA:1..50,000', tracks: ['volvox_gff3'] }}
      />
    </div>
  )
}
