import { Suspense, createRef } from 'react'

import { render, waitFor } from '@testing-library/react'

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

// the ref arrives a frame after mount, and now a frame after the engine's view
// and display state models resolve as well — `<JBrowse>` renders nothing until
// then
test('<JBrowse /> maps the views prop into session.views', async () => {
  const ref = createRef<ViewModel | undefined>()
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

  await waitFor(() => {
    expect(ref.current).toBeDefined()
  })
  const { views } = ref.current!.session
  expect(views).toHaveLength(1)
  expect(views[0]!.type).toBe('LinearGenomeView')
  // the per-view init blob must actually reach the view model, not be dropped
  expect(views[0]!.init).toEqual({ assembly: 'volvox', loc: 'ctgA:1-10' })
})

test('<JBrowse /> honors sessionName without any views', async () => {
  const ref = createRef<ViewModel | undefined>()
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <JBrowse
        ref={ref}
        assemblies={assemblies}
        tracks={[]}
        sessionName="my session"
      />
    </Suspense>,
  )

  await waitFor(() => {
    expect(ref.current).toBeDefined()
  })
  expect(ref.current!.session.name).toBe('my session')
})
