import { useRef } from 'react'

import { createCircularGenomeView } from '@jbrowse/react-circular-genome-view2'

import type { CircularGenomeViewController } from '@jbrowse/react-circular-genome-view2'

export default function WithoutReact() {
  const controller = useRef<CircularGenomeViewController>(undefined)
  return (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        <button
          type="button"
          onClick={() => {
            void controller.current?.update({ displayedRegionNames: ['ctgA'] })
          }}
        >
          Only ctgA
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            void controller.current?.update({ displayedRegionNames: [] })
          }}
        >
          The whole assembly
        </button>
      </div>
      <div
        ref={el => {
          if (el) {
            const created = createCircularGenomeView(el, {
              assembly: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
              tracks: [
                'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
              ],
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
