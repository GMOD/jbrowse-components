import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, render } from '@testing-library/react'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import { createJBrowseTheme } from '../../ui/index.ts'
import { stateModelFactory } from '../stateModelFactory.ts'
import FeatureDetails from './FeatureDetails.tsx'
import BaseFeatureDetails from './index.tsx'

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

// same shape as setup(), plus the caller-supplied props FeatureDetails threads
// down through the subfeature cards
function setupWithDescriptions(feature: SimpleFeatureSerialized) {
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
      <FeatureDetails
        model={model.widget}
        feature={feature}
        descriptions={{ score: 'the confidence score' }}
        formatter={value => <span>{`fmt:${value}`}</span>}
      />
    </ThemeProvider>,
  )
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

test('callback can override the derived Length row', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    __jbrowsefmt: { length: '100 bp (approx)' },
  })
  expect(await findByText('100 bp (approx)')).toBeTruthy()
  expect(queryByText('100')).toBeNull()
})

test('callback can hide the derived Length row', async () => {
  const { findByText, queryByText } = setup({
    ...base,
    __jbrowsefmt: { length: null },
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(queryByText('Length')).toBeNull()
})

// a bare URL is linkified on the way to the panel, so the common link-out
// recipe needs no <a> markup in the callback. Documented in the config guide
test('a formatted value that is just a URL renders as a link', async () => {
  const { findByText } = setup({
    ...base,
    __jbrowsefmt: { homepage: 'https://example.com/gene' },
  })
  const link = await findByText('https://example.com/gene')
  const anchor = link.closest('a')
  expect(anchor?.getAttribute('href')).toBe('https://example.com/gene')
  // a same-tab navigation would discard the session, and in an embedded
  // JBrowse it would take the host page with it
  expect(anchor?.getAttribute('target')).toBe('_blank')
  expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer')
})

// the same courtesy for a value that came straight out of the file, with no
// formatDetails callback involved: a GFF3 attribute holding a URL is a link
test('a raw attribute that is just a URL renders as a link', async () => {
  const { findByText } = setup({ ...base, homepage: 'https://example.com/raw' })
  const anchor = (await findByText('https://example.com/raw')).closest('a')
  expect(anchor?.getAttribute('href')).toBe('https://example.com/raw')
  expect(anchor?.getAttribute('target')).toBe('_blank')
})

// FeatureDetails recurses for each subfeature card; a subfeature's fields are
// the same fields, so the caller's descriptions and value formatter (which ride
// the same props) have to reach them too
test('subfeature cards get the caller formatter', async () => {
  const { findAllByText } = setupWithDescriptions({
    ...base,
    subfeatures: [
      { refName: 'ctgA', start: 2, end: 52, type: 'exon', score: 9 },
    ],
  })
  // the parent's own score plus the subfeature's, both run through formatter
  expect((await findAllByText('fmt:37')).length).toBe(1)
  expect((await findAllByText('fmt:9')).length).toBe(1)
})
