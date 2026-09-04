import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, render } from '@testing-library/react'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationSchema,
  FormatDetailsConfigSchemaFactory,
} from '../configuration/index.ts'
import { createJBrowseTheme } from '../ui/index.ts'
import BaseFeatureDetails from './BaseFeatureDetail/index.tsx'
import { stateModelFactory } from './index.ts'

test('open up a widget', async () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
      },
    },
    { pluginManager },
  )
  const { container, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'hello',
      start: 2,
      end: 102,
      strand: 1,
      score: 37,
      refName: 'ctgA',
    })
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})

// `configuration.formatDetails` is the session-wide tier of the same callbacks a
// track carries. The widget's track is a safeReference: it can be absent because
// nothing opened the widget from a track, or because the track was closed while
// the widget stayed open. The global callbacks still have to run.
test('session-level formatDetails applies with no track', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {
      formatDetails: FormatDetailsConfigSchemaFactory(),
    }),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      configuration: {
        formatDetails: {
          feature: "jexl:{sessionField:'from the session config'}",
        },
      },
      widget: { type: 'BaseFeatureWidget' },
    },
    { pluginManager },
  )
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'hello',
      start: 2,
      end: 102,
      refName: 'ctgA',
    })
  })
  expect(await findByText('sessionField')).toBeTruthy()
  expect(await findByText('from the session config')).toBeTruthy()
})

// The panel is reused rather than remounted when another feature is clicked
// (see SequenceFeatureDetailsRemount.test.tsx), so nothing about the drawer
// itself says the click landed. Note the swap has to happen on a mounted tree:
// re-rendering a fresh one would restart the cue for free.
test('a feature swap washes the panel, and a re-format of the same feature does not', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        featureData: { uniqueId: 'one', refName: 'ctgA', start: 2, end: 102 },
      },
    },
    { pluginManager },
  )
  const { queryByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('ctgA:3..102')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeNull()

  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'one',
      refName: 'ctgA',
      start: 2,
      end: 102,
      extra: 'reformatted',
    })
  })
  expect(await findByText('reformatted')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeNull()

  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'two',
      refName: 'ctgA',
      start: 200,
      end: 300,
    })
  })
  expect(await findByText('ctgA:201..300')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeTruthy()
})

// A transcript clicked inside a gene opens the panel on the transcript alone,
// and its card is headed `NM_004006.2 - mRNA` -- nothing there says DMD. The
// display resolves the containing feature at click time (see
// parentFeatureSummary) and the panel names it above the card.
test('the panel names the feature it was reached through', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        featureData: {
          uniqueId: 'mRNA1',
          refName: 'ctgA',
          start: 2,
          end: 102,
          name: 'NM_004006.2',
          type: 'mRNA',
        },
        parentFeature: { name: 'DMD', type: 'gene' },
      },
    },
    { pluginManager },
  )
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('in gene DMD')).toBeTruthy()
})

// Every other feature in the tree is clicked as itself, and a line above the
// card is only noise there.
test('the panel says nothing about a parent it was not given', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        featureData: { uniqueId: 'gene1', refName: 'ctgA', start: 2, end: 102 },
      },
    },
    { pluginManager },
  )
  const { queryByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('ctgA:3..102')).toBeTruthy()
  expect(queryByTestId('parent-feature-line')).toBeNull()
})
