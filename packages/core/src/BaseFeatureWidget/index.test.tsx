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
