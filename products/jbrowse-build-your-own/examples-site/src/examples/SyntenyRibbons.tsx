import { Suspense } from 'react'

import { useWidthSetter } from '@jbrowse/core/util/hooks'
import {
  EmbedProvider,
  TrackStack,
  ViewStatus,
} from '@jbrowse/display-ui/embed'
import { LevelSyntenyCanvas } from '@jbrowse/plugin-linear-comparative-view'
import { useCreateViewState } from '@jbrowse/react-app2'
import { observer } from 'mobx-react'

import type {
  LinearSyntenyViewHelperModel,
  LinearSyntenyViewModel,
} from '@jbrowse/plugin-linear-comparative-view'

const Ribbons = observer(function Ribbons({
  level,
}: {
  level: LinearSyntenyViewHelperModel
}) {
  return (
    <div style={{ position: 'relative', height: level.height }}>
      <LevelSyntenyCanvas model={level} />
      {level.linearSyntenyDisplays.map(display => (
        <div
          key={display.id}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <Suspense fallback={null}>
            <display.RenderingComponent model={display} />
          </Suspense>
        </div>
      ))}
    </div>
  )
})

const Rows = observer(function Rows({
  view,
}: {
  view: LinearSyntenyViewModel
}) {
  const ref = useWidthSetter(view)
  return (
    <div ref={ref}>
      {view.status.type === 'ready' ? (
        view.views.map((row, i) => {
          const level = view.levels[i - 1]
          return (
            <div key={row.id}>
              {level ? <Ribbons level={level} /> : null}
              <TrackStack view={row}>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, padding: 2 }}>
                  {row.assemblyNames[0]}
                </div>
              </TrackStack>
            </div>
          )
        })
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})

const geneTrack = (assembly: string) => ({
  trackId: `${assembly}_genes`,
  name: `RefSeq curated (${assembly})`,
  uri: `https://jbrowse.org/ucsc/${assembly}/ncbiRefSeqCurated.gff.gz`,
  index: `https://jbrowse.org/ucsc/${assembly}/ncbiRefSeqCurated.gff.gz.csi`,
  assemblyNames: [assembly],
  displayDefaults: { height: 110, geneGlyphMode: 'longestCoding' },
})

const chromSizes = (assembly: string) => ({
  name: assembly,
  sequence: {
    adapter: {
      type: 'ChromSizesAdapter',
      uri: `https://jbrowse.org/ucsc/${assembly}/${assembly}.chrom.sizes`,
    },
  },
})

const SyntenyRibbons = observer(function SyntenyRibbons() {
  const state = useCreateViewState({
    config: {
      assemblies: [chromSizes('hg38'), chromSizes('mm39')],
      tracks: [
        geneTrack('hg38'),
        geneTrack('mm39'),
        {
          type: 'SyntenyTrack',
          trackId: 'hg38_mm39',
          name: 'Human vs mouse (UCSC liftOver)',
          assemblyNames: ['hg38', 'mm39'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz',
            csi: true,
            assemblyNames: ['mm39', 'hg38'],
          },
        },
      ],
      defaultSession: {
        name: 'synteny',
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'hg38',
                loc: 'chr17:43,040,000..43,130,000',
                tracks: ['hg38_genes'],
              },
              {
                assembly: 'mm39',
                loc: 'chr11:101,375,000..101,447,000',
                tracks: ['mm39_genes'],
              },
            ],
            tracks: ['hg38_mm39'],
            drawCurves: true,
            cigarMode: 'matches',
          },
        ],
      },
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <Rows view={session.views[0] as LinearSyntenyViewModel} />
    </EmbedProvider>
  )
})

export default SyntenyRibbons
