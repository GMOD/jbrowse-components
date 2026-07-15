import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, render } from '@testing-library/react'

import BaseFeatureDetails from './index.tsx'
import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import { createJBrowseTheme } from '../../ui/index.ts'
import { stateModelFactory } from '../stateModelFactory.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'

// A `formatDetails.feature`/`formatDetails.subfeatures` callback returns an
// object that the autorun merges onto the feature as `__jbrowsefmt`: new keys
// add fields, existing keys override the raw value, and a key set to
// null/undefined hides the field (all detail components filter with `!= null`).
//
// The autorun is what populates `__jbrowsefmt` from the track/session jexl
// callbacks, so `setFormattedData` here injects the exact shape a callback
// produces, exercising the render contract without standing up a track + jexl.
function setup(feature: SimpleFeatureSerialized) {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    { widget: { type: 'BaseFeatureWidget' } },
    { pluginManager },
  )
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  act(() => {
    model.widget.setFormattedData(feature)
  })
  return utils
}

const base: SimpleFeatureSerialized = {
  uniqueId: 'f1',
  refName: 'ctgA',
  start: 2,
  end: 102,
  strand: 1,
  score: 37,
}

test('callback adds an extra field', async () => {
  const { findByText } = setup({
    ...base,
    __jbrowsefmt: { customField: 'hello world' },
  })
  expect(await findByText('customField')).toBeTruthy()
  expect(await findByText('hello world')).toBeTruthy()
})

test('callback overrides an existing field value', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    __jbrowsefmt: { score: '37 (high confidence)' },
  })
  expect(await findByText('37 (high confidence)')).toBeTruthy()
  // the raw value is replaced, not shown alongside
  expect(queryByText('37')).toBeNull()
})

test('callback hides a field by setting it null', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    __jbrowsefmt: { score: null },
  })
  // the panel still renders (position is always present)
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(queryByText('score')).toBeNull()
})

test('callback hides a field by setting it undefined', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    __jbrowsefmt: { score: undefined },
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(queryByText('score')).toBeNull()
})

test('callback can hide a core detail field (type)', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    type: 'gene',
    __jbrowsefmt: { type: undefined },
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(queryByText('Type')).toBeNull()
})

test('formatted value can be an html link', async () => {
  const { findByText } = setup({
    ...base,
    __jbrowsefmt: { homepage: 'https://example.com/gene' },
  })
  const link = await findByText('https://example.com/gene')
  expect(link.closest('a')?.getAttribute('href')).toBe(
    'https://example.com/gene',
  )
})
