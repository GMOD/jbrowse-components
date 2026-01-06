import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { stateModelFactory } from './index.ts'
import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import BaseFeatureDetails from './BaseFeatureDetail/index.tsx'
import { createJBrowseTheme } from '../ui/index.ts'

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
  model.widget.setFeatureData({
    uniqueId: 'hello',
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    refName: 'ctgA',
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})
