// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { observer } from 'mobx-react'

import {
  assembly,
  getExonRegionsFromFeature,
  regionsToLocString,
  tracks,
  transcript,
} from './WithMultipleDisplayedRegions.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

const FlipView = observer(function FlipView({ state }: { state: ViewModel }) {
  const view = state.session.view
  const isFlipped = view.displayedRegions[0]?.reversed ?? false
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => {
            view.horizontallyFlip()
          }}
        >
          {isFlipped ? 'Unflip (show 5′→3′)' : 'Flip horizontally (show 3′→5′)'}
        </button>
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

export const WithMultipleDisplayedRegionsFlipped = () => {
  const [state] = useState(() => {
    const loc = regionsToLocString(getExonRegionsFromFeature(transcript))
    return createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Multi-region flipped example',
        view: {
          id: 'multi_region_flipped_view',
          type: 'LinearGenomeView',
          init: {
            loc,
            assembly: 'GRCh38',
            tracks: [
              'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
              'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            ],
          },
        },
      },
    })
  })

  return (
    <div>
      <p>
        Same transcript as <em>WithMultipleDisplayedRegions</em> but with a
        button to horizontally flip all displayed regions, showing the gene in
        its transcription orientation (3′→5′ left-to-right).
      </p>
      <FlipView state={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithMultipleDisplayedRegionsFlipped.tsx">
        Source code
      </a>
    </div>
  )
}
