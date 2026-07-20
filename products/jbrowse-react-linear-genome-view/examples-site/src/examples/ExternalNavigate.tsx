import { useRef } from 'react'

import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

// navigate with a JBrowse locstring
const bookmarks = [
  { label: 'ctgA — region A', loc: 'ctgA:1,000..5,000' },
  { label: 'ctgA — region B', loc: 'ctgA:20,000..25,000' },
  { label: 'ctgB — region C', loc: 'ctgB:1..2,000' },
]

// navigate with parsed {refName, start, end} coordinates you already have
const hits = [
  { label: 'gene1', refName: 'ctgA', start: 1050, end: 9000 },
  { label: 'gene2', refName: 'ctgA', start: 20000, end: 23000 },
  { label: 'gene3', refName: 'ctgB', start: 100, end: 1500 },
]

export default function ExternalNavigate() {
  const ref = useRef<ViewModel>(null)
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div>
          <code>navToLocString</code> (locstring):
        </div>
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
      <div style={{ marginBottom: 8 }}>
        <div>
          <code>navToLocations</code> (location object):
        </div>
        {hits.map(h => (
          <button
            key={h.label}
            style={{ marginRight: 8 }}
            onClick={() => {
              ref.current?.session.view
                .navToLocations(
                  [{ refName: h.refName, start: h.start, end: h.end }],
                  assembly.name,
                )
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={[
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
        ]}
        init={{ loc: 'ctgA:1,000..5,000' }}
      />
    </div>
  )
}
