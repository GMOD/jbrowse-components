import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.cram',
    },
  },
]

export default function FitToContainer() {
  return (
    <>
      <style>{`.jbrowseFitDemo { --jbrowse-app-height: 100%; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 14,
            background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
            borderBottom:
              '1px solid color-mix(in srgb, CanvasText 20%, Canvas)',
          }}
        >
          Your own app chrome lives here. The embedded JBrowse below fills the
          remaining space instead of forcing the full viewport height.
        </div>
        <div className="jbrowseFitDemo" style={{ flex: 1, minHeight: 0 }}>
          <JBrowse
            assemblies={assemblies}
            tracks={tracks}
            views={[
              {
                type: 'LinearGenomeView',
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
                tracklist: true,
              },
            ]}
          />
        </div>
      </div>
    </>
  )
}
