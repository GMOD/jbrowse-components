// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'
import { TextEncoder } from 'fastestsmallesttextencoderdecoder'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import JBrowse from '../JBrowse'
import { setup, getPluginManager } from './util'
import emptyConfig from '../../test_data/empty.json'

test('catches no assemblies with empty config', async () => {
  const pluginManager = getPluginManager(emptyConfig)
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
  expect(await findByText('No configured assemblies')).toBeTruthy()
})
