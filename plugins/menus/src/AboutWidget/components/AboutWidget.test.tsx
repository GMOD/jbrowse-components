import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { render } from '@testing-library/react'
import { types } from '@jbrowse/mobx-state-tree'

import AboutWidget from './AboutWidget'

describe('<AboutWidget />', () => {
  it('renders', () => {
    const session = types
      .model({
        configuration: ConfigurationSchema('Null', {}),
        rpcManager: types.frozen({}),
        widgetModel: types.model({ type: types.literal('AboutWidget') }),
      })
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
    const { container } = render(<AboutWidget model={session.widgetModel} />)
    expect(container).toMatchSnapshot()
  })
})
