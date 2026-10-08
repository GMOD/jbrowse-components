import { useRef, useState } from 'react'

import { createLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

import type { LinearGenomeViewController } from '@jbrowse/react-linear-genome-view2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'
const genes = `${base}/volvox.sort.gff3.gz`
const reads = `${base}/volvox-sorted.cram`

export default function WithoutReact() {
  const controller = useRef<LinearGenomeViewController>(undefined)
  const [location, setLocation] = useState('')
  return (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        <button
          type="button"
          onClick={() => {
            void controller.current?.update({ location: 'ctgA:20000..30000' })
          }}
        >
          Go to ctgA:20000..30000
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            void controller.current?.update({ tracks: [genes, reads] })
          }}
        >
          Genes and reads
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            void controller.current?.update({ tracks: [genes] })
          }}
        >
          Genes only
        </button>{' '}
        {location}
      </div>
      <div
        ref={el => {
          if (el) {
            const created = createLinearGenomeView(el, {
              assembly: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
              tracks: [genes],
              location: 'ctgA:1..50000',
              onLocationChange: setLocation,
            })
            controller.current = created
            return () => {
              created.destroy()
            }
          }
        }}
      />
    </div>
  )
}
