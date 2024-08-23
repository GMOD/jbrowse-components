import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

import AboutWidget from './AboutWidget'

test('renders', () => {
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
