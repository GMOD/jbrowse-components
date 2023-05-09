import React from 'react'
import { fireEvent, render } from '@testing-library/react'

import StartScreen from '../StartScreen'
import factoryReset from '../factoryReset'
import { setup, getPluginManager } from './util'

setup()

describe('<StartScreen />', () => {
  it('renders with an empty views config', async () => {
    const pluginManager = getPluginManager({})
    const root = pluginManager.rootModel
    const { findByText } = render(
      <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
    )
    expect(await findByText('Start a new session')).toBeTruthy()
  })
})

test('Add New Session', async () => {
  const pluginManager = getPluginManager()
  const root = pluginManager.rootModel!
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Empty'))
  expect(root.session).toBeTruthy()
})

test('Add New LGV Session', async () => {
  const pluginManager = getPluginManager()
  const root = pluginManager.rootModel!
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Linear Genome View'))
  expect(root.session!.views.length).toBeGreaterThan(0)
})

test('Add New SV Inspector Session', async () => {
  const pluginManager = getPluginManager()
  const root = pluginManager.rootModel!
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Structural Variant Inspector'))
  expect(root.session!.views.length).toBeGreaterThan(0)
})
