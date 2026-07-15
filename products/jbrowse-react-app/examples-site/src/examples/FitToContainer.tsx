import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'TwoBitAdapter',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      },
    },
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        adapterId: 'W6DyPGJ0UU',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
  },
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

// The app root defaults to height:100vh (full window). Setting the
// --jbrowse-app-height variable on an ancestor with a definite height makes the
// app fit that box instead — here the flex child below a header bar. It's set
// in a stylesheet rule because a CSS custom property can't go in a typed React
// inline-style object without a cast.
export default function FitToContainer() {
  return (
    <>
      <style>{`.jbrowseFitDemo { --jbrowse-app-height: 100%; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 14,
            background: '#eef2ff',
            borderBottom: '1px solid #c7d2fe',
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
                init: {
                  assembly: 'volvox',
                  loc: 'ctgA:1..50000',
                  tracks: ['volvox_cram'],
                  tracklist: true,
                },
              },
            ]}
          />
        </div>
      </div>
    </>
  )
}
