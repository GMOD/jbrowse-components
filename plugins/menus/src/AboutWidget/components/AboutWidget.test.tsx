import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import AboutWidget from './AboutWidget.tsx'

describe('<AboutWidget />', () => {
  it('renders', () => {
    const rpcConfig = ConfigurationSchema('NullRpc', {
      defaultDriver: {
        type: 'string',
        defaultValue: 'MainThreadRpcDriver',
      },
    }).create({})
    const session = types
      .model({
        configuration: ConfigurationSchema('Null', {}),
        widgetModel: types.model({ type: types.literal('AboutWidget') }),
      })
      .volatile(() => ({
        rpcManager: { mainConfiguration: rpcConfig },
      }))
      .create(
        { widgetModel: { type: 'AboutWidget' } },
        {
          pluginManager: {
            pluginMetadata: {},
            plugins: [
              {
                name: 'HelloPlugin',
                version: '1.0.0',
                url: 'http://google.com',
              },
            ],
          },
        },
      )
    const { container } = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <AboutWidget model={session.widgetModel} />
      </ThemeProvider>,
    )
    expect(container).toMatchSnapshot()
  })
})
