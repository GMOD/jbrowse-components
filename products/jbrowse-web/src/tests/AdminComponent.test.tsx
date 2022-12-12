import React from 'react'
import { render } from '@testing-library/react'
import { JBrowse, getPluginManager } from './util'

test('renders when in admin mode', async () => {
  const pluginManager = getPluginManager({}, true)
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
  expect(await findByText('Admin')).toBeTruthy()
})
