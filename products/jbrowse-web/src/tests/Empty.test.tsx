import { cleanup, render } from '@testing-library/react'
import { afterEach, test } from 'vitest'

import { JBrowse, getPluginManager } from './util'
import emptyConfig from '../../test_data/empty.json'
afterEach(() => {
  cleanup()
})
test('catches no assemblies with empty config', async () => {
  const pluginManager = getPluginManager(emptyConfig)
  const { findAllByText } = render(<JBrowse pluginManager={pluginManager} />)
  await findAllByText('No configured assemblies')
})
