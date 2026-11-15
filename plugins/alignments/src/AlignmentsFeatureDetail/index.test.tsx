import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import ReactComponent from './AlignmentsFeatureDetail.tsx'
import { stateModelFactory } from './stateModelFactory.ts'

test('open up a widget', async () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const session = Session.create(
    {
      widget: { type: 'AlignmentsFeatureWidget' },
    },
    { pluginManager },
  )
  session.widget.setFeatureData({
    uniqueId: 'hello',
    seq: 'TTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAG',
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    qual: '17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17',
    MQ: 37,
    CIGAR: '100M',
    length_on_ref: 100,
    template_length: 0,
    seq_length: 100,
    name: 'ctgA_3_555_0:0:0_2:0:0_102d',
    refName: 'ctgA',
    type: 'match',
  })
  const { container, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ReactComponent model={session.widget} />,
    </ThemeProvider>,
  )
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})

// The widget is reused for the next read clicked, so a card collapsed on one
// read would otherwise stay collapsed on a read it was never collapsed on.
test('a card collapsed on one read opens on the next', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const session = Session.create(
    { widget: { type: 'AlignmentsFeatureWidget' } },
    { pluginManager },
  )
  const read = (uniqueId: string) => ({
    uniqueId,
    start: 2,
    end: 102,
    refName: 'ctgA',
    name: uniqueId,
    flags: 0,
  })
  session.widget.setFeatureData(read('one'))
  const { findByText, queryByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ReactComponent model={session.widget} />
    </ThemeProvider>,
  )
  fireEvent.click(await findByText('Flags'))
  await waitFor(() => {
    expect(queryByText('read paired')).toBeNull()
  })
  act(() => {
    session.widget.setFeatureData(read('two'))
  })
  expect(await findByText('read paired')).toBeTruthy()
})

test('clicking another read keeps the sequence panel open', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const session = Session.create(
    { widget: { type: 'AlignmentsFeatureWidget' } },
    { pluginManager },
  )
  const read = (uniqueId: string) => ({
    uniqueId,
    start: 2,
    end: 102,
    refName: 'ctgA',
    name: uniqueId,
  })
  session.widget.setFeatureData(read('one'))
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ReactComponent model={session.widget} />
    </ThemeProvider>,
  )
  fireEvent.click(await findByText('Show feature sequence'))
  expect(await findByText('Hide feature sequence')).toBeTruthy()
  act(() => {
    session.widget.setFeatureData(read('two'))
  })
  expect(await findByText('ctgA:3..102')).toBeTruthy()
  expect(await findByText('Hide feature sequence')).toBeTruthy()
})
