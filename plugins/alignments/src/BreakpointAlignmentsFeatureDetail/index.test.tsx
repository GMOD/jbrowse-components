import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import ReactComponent from './BreakpointAlignmentsFeatureDetail.tsx'
import { stateModelFactory } from './stateModelFactory.ts'

function read(uniqueId: string, extra: Record<string, unknown> = {}) {
  return {
    uniqueId,
    name: uniqueId,
    refName: 'ctgA',
    start: 2,
    end: 102,
    strand: 1,
    flags: 2049,
    tags: { SA: 'ctgB,500,+,50S50M,60,0;' },
    ...extra,
  }
}

function setup() {
  const pluginManager = new PluginManager([])
  const Session = types
    .model({
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      widgets: types.map(stateModelFactory(pluginManager)),
    })
    .actions(self => ({
      addWidget(initialState: Record<string, unknown>) {
        self.widgets.set('breakpointAlignments', {
          ...initialState,
          id: 'breakpointAlignments',
          type: 'BreakpointAlignmentsWidget',
        })
        return self.widgets.get('breakpointAlignments')!
      },
    }))
  const session = Session.create({}, { pluginManager })
  const open = (initialState: Record<string, unknown>) => {
    let widget: ReturnType<typeof session.addWidget> | undefined
    act(() => {
      widget = session.addWidget(initialState)
    })
    return widget!
  }
  return { open }
}

function renderWidget(model: Parameters<typeof ReactComponent>[0]['model']) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ReactComponent model={model} />
    </ThemeProvider>,
  )
}

test('a session saved with featureData holding feature1 and feature2 loads both reads', () => {
  const { open } = setup()
  const widget = open({
    featureData: { feature1: read('one'), feature2: read('two') },
  })
  expect(widget.read1.featureData?.uniqueId).toBe('one')
  expect(widget.read2.featureData?.uniqueId).toBe('two')
})

test('each read shows the alignments detail: its SA list and Flags card', async () => {
  const { open } = setup()
  const widget = open({
    read1: { featureData: read('one') },
    read2: { featureData: read('two') },
  })
  const { findAllByText } = renderWidget(widget)
  expect(await findAllByText('Flags')).toHaveLength(2)
  expect(
    await findAllByText('List of supplementary alignment locations'),
  ).toHaveLength(2)
  expect(await findAllByText('read paired')).toHaveLength(2)
})

test('a read too large to persist is left out of the snapshot, and its partner is not', () => {
  const { open } = setup()
  const long = 'A'.repeat(2_100_000)
  const widget = open({
    read1: { featureData: read('one', { seq: long }) },
    read2: { featureData: read('two') },
  })
  const snap = getSnapshot(widget)
  expect(snap.read1.featureData).toBeUndefined()
  expect(snap.read2.featureData).toMatchObject({ uniqueId: 'two' })

  const both = getSnapshot(
    open({
      read1: { featureData: read('three', { seq: long }) },
      read2: { featureData: read('four', { qual: long }) },
    }),
  )
  expect(both.read1.featureData).toBeUndefined()
  expect(both.read2.featureData).toBeUndefined()
})

// the widget is reused for the next pair clicked, so a card collapsed on one
// pair's read would otherwise stay collapsed on the next pair's
test('a card collapsed on one pair opens on the next', async () => {
  const { open } = setup()
  const widget = open({
    read1: { featureData: read('one') },
    read2: { featureData: read('two') },
  })
  const { findAllByText, queryAllByText } = renderWidget(widget)
  fireEvent.click((await findAllByText('Flags'))[0]!)
  await waitFor(() => {
    expect(queryAllByText('read paired')).toHaveLength(1)
  })
  const next = open({
    read1: { featureData: read('three') },
    read2: { featureData: read('four') },
  })
  expect(next).toBe(widget)
  expect(widget.read1.featureData?.uniqueId).toBe('three')
  expect(await findAllByText('read paired')).toHaveLength(2)
})
