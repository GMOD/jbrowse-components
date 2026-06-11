import { Suspense, createRef } from 'react'

import { render } from '@testing-library/react'

import JBrowse from './JBrowse.tsx'

import type { ViewModel } from '../createModel.ts'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

test('<JBrowse /> maps the views prop into session.views', () => {
  const ref = createRef<ViewModel>()
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <JBrowse
        ref={ref}
        assemblies={assemblies}
        tracks={[]}
        views={[
          {
            type: 'LinearGenomeView',
            init: { assembly: 'volvox', loc: 'ctgA:1-10' },
          },
        ]}
      />
    </Suspense>,
  )

  const { views } = ref.current!.session
  expect(views).toHaveLength(1)
  expect(views[0]!.type).toBe('LinearGenomeView')
})
