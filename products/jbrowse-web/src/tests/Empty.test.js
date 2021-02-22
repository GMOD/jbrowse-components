// library
import '@testing-library/jest-dom/extend-expect'

import { render } from '@testing-library/react'
import React from 'react'

// locals
import JBrowse from '../JBrowse'
import { getPluginManager } from './util'
import emptyConfig from '../../test_data/empty.json'

test('catches no assemblies with empty config', async () => {
  const pluginManager = getPluginManager(emptyConfig)
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
  expect(await findByText('No configured assemblies')).toBeTruthy()
})
