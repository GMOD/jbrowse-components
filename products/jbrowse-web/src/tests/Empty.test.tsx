import { render } from '@testing-library/react'

import { JBrowse, getPluginManager } from './util'
import emptyConfig from '../../test_data/empty.json'

test('catches no assemblies with empty config', async () => {
  const pluginManager = getPluginManager(emptyConfig)
  const { findAllByText } = render(<JBrowse pluginManager={pluginManager} />)
  await findAllByText('No configured assemblies')
})
