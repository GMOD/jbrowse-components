import '@testing-library/jest-dom'

import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { isSessionWithMultipleViews } from '@jbrowse/core/util/types'
import {
  displayTestSessionModel,
  testAssembly,
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import CollapseIntronsDialog from './CollapseIntronsDialog.tsx'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

afterEach(cleanup)

const CTG_A = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 }

const assembly = {
  name: 'volvox',
  getCanonicalRefName2: (r: string) => r,
  regions: [CTG_A],
  getRegionForRefName: (r: string) => (r === 'ctgA' ? CTG_A : undefined),
} as unknown as Assembly

function exon(uniqueId: string, start: number, end: number) {
  return { uniqueId, refName: 'ctgA', start, end, type: 'exon' }
}

const transcripts = [
  new SimpleFeature({
    uniqueId: 'EDEN.1',
    refName: 'ctgA',
    start: 1050,
    end: 3902,
    type: 'mRNA',
    name: 'EDEN.1',
    subfeatures: [exon('e1', 1050, 1500), exon('e2', 3000, 3902)],
  }),
  new SimpleFeature({
    uniqueId: 'EDEN.2',
    refName: 'ctgA',
    start: 5000,
    end: 7600,
    type: 'mRNA',
    name: 'EDEN.2',
    subfeatures: [exon('e3', 5000, 5500), exon('e4', 7000, 7600)],
  }),
]

function sessionBase() {
  const pluginManager = new PluginManager([])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const LinearGenomeView = linearGenomeViewStateModelFactory(pluginManager)
  return {
    pluginManager,
    LinearGenomeView,
    base: displayTestSessionModel({
      viewModel: LinearGenomeView,
      assemblyManager: testAssemblyManager(testAssembly()),
      getTrackById: () => undefined,
    }),
  }
}

// The shape jbrowse-web, desktop and react-app share: views are a list, and
// addView appends to it.
function multiViewSession() {
  const { pluginManager, LinearGenomeView, base } = sessionBase()
  const Session = types
    .compose(
      'MultiViewTestSession',
      base,
      types.model({ views: types.array(LinearGenomeView) }),
    )
    .actions(self => ({
      addView(
        typeName: 'LinearGenomeView',
        initialState: SnapshotIn<typeof LinearGenomeView> = {},
      ) {
        self.views.push({ ...initialState, type: typeName })
        return self.views[self.views.length - 1]!
      },
      removeView(view: LinearGenomeViewModel) {
        self.views.remove(view)
      },
    }))
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.addView('LinearGenomeView', {})
  return { session, view }
}

// The shape of the embedded react-LGV session: one view, `views` a fresh plain
// array wrapping it, and an addView that overwrites it.
function singleViewSession() {
  const { pluginManager, LinearGenomeView, base } = sessionBase()
  const Session = base
    .views(self => ({
      get views() {
        return self.view ? [self.view] : []
      },
    }))
    .actions(self => ({
      addView(
        typeName: 'LinearGenomeView',
        initialState: SnapshotIn<typeof LinearGenomeView> = {},
      ) {
        return self.setView(
          LinearGenomeView.create({ ...initialState, type: typeName }),
        )
      },
      removeView() {},
    }))
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.addView('LinearGenomeView', {})
  return { session, view }
}

function renderDialog(view: LinearGenomeViewModel) {
  view.setWidth(800)
  view.setDisplayedRegions([CTG_A])
  const handleClose = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CollapseIntronsDialog
        view={view}
        transcripts={transcripts}
        assembly={assembly}
        handleClose={() => {
          handleClose()
        }}
        featureId="EDEN"
        featureName="EDEN"
        trackId="test_track"
      />
    </ThemeProvider>,
  )
  return { handleClose }
}

const windowSizeInput = () =>
  screen.getByLabelText('Number of bp around splice site to include')

function actionButton(label: string) {
  const button = screen.getByText(label).closest('button')
  if (!button) {
    throw new Error(`no button labeled "${label}"`)
  }
  return button
}

describe('the "Open in new view" action', () => {
  it('is offered by a session whose addView appends', () => {
    const { session, view } = multiViewSession()
    expect(isSessionWithMultipleViews(session)).toBe(true)
    renderDialog(view)
    expect(screen.getByText('Open in new view')).toBeInTheDocument()
  })

  it('is withheld from the embedded single-view session', () => {
    const { session, view } = singleViewSession()
    expect(isSessionWithMultipleViews(session)).toBe(false)
    renderDialog(view)
    expect(screen.queryByText('Open in new view')).toBeNull()
    expect(screen.getByText('Replace current view')).toBeInTheDocument()
  })
})

describe('the window-size field', () => {
  it('disables both actions while invalid', () => {
    const { view } = multiViewSession()
    renderDialog(view)
    fireEvent.change(windowSizeInput(), { target: { value: '-5' } })
    expect(screen.getByText('Must be a non-negative number')).toBeVisible()
    expect(actionButton('Replace current view')).toBeDisabled()
    expect(actionButton('Open in new view')).toBeDisabled()

    fireEvent.change(windowSizeInput(), { target: { value: '20' } })
    expect(actionButton('Replace current view')).toBeEnabled()
    expect(actionButton('Open in new view')).toBeEnabled()
  })
})

describe('the launched view', () => {
  it('is named for the gene when every transcript is in scope', () => {
    const { session, view } = multiViewSession()
    const { handleClose } = renderDialog(view)
    fireEvent.click(screen.getByText('Open in new view'))

    expect(session.views).toHaveLength(2)
    expect(session.views[1]!.displayName).toBe('EDEN (introns collapsed)')
    expect(session.views[0]).toBe(view)
    expect(handleClose).toHaveBeenCalled()
  })

  it('is named for the transcript that was picked', () => {
    const { session, view } = multiViewSession()
    renderDialog(view)
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText(/^EDEN\.2 \(/))
    fireEvent.click(screen.getByText('Open in new view'))

    expect(session.views[1]!.displayName).toBe('EDEN.2 (introns collapsed)')
    // one transcript with two exons collapses to two regions
    expect(
      session.views[1]!.displayedRegions.map(r => [r.start, r.end]),
    ).toEqual([
      [4900, 5600],
      [6900, 7700],
    ])
  })
})
