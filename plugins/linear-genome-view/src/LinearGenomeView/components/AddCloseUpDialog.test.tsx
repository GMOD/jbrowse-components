import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { when } from 'mobx'

import AddCloseUpDialog from './AddCloseUpDialog.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 1_000_000 },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Gene annotations',
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  // the assembly manager builds its models in an autorun, and until it has, a
  // track launched here has no assembly to resolve against
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1_000_000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 400_000)
  return { session, view }
}

function closeUps(view: LinearGenomeViewModel) {
  return view.closeUpViews as LinearGenomeViewModel[]
}

function open(view: LinearGenomeViewModel) {
  return render(
    <AddCloseUpDialog
      model={view}
      leftOffset={view.pxToBp(100)}
      rightOffset={view.pxToBp(300)}
      handleClose={() => {}}
    />,
  )
}

// One control, and it is not a span: the drag already named that, and the
// dialog says which one it is about to open
test('the dialog names the dragged span and opens a close-up over it', async () => {
  const { view } = await setup()
  const { getByRole, baseElement } = open(view)
  expect(baseElement.textContent).toContain('ctgA:401,001..403,000')
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(closeUps(view).map(l => l.windowWidthBp)).toEqual([2000])
})

test("the view's tracks come over by default", async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = open(view)
  expect(
    (
      getByRole('checkbox', {
        name: "Copy this view's tracks",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true)
  fireEvent.click(getByRole('button', { name: 'Add' }))
  await waitFor(() => {
    expect(closeUps(view)[0]!.tracks.map(t => t.configuration.trackId)).toEqual(
      ['genes'],
    )
  })
})

test('the box unchecked opens an empty close-up', async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = open(view)
  fireEvent.click(getByRole('checkbox', { name: "Copy this view's tracks" }))
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(closeUps(view)[0]!.tracks).toEqual([])
})
