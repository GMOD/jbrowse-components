import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import StartScreen from '../components/StartScreen'
import factoryReset from '../factoryReset'
import { getPluginManager } from './util'

afterEach(() => {
  cleanup()
})
test('Empty config', async () => {
  const pluginManager = getPluginManager({})
  const root = pluginManager.rootModel
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  expect(await findByText('Start a new session')).toBeTruthy()
}, 10000)

test('Add new session', async () => {
  const { rootModel: root } = getPluginManager()
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Empty'))
  expect(root.session).toBeTruthy()
}, 10000)

test('Add new LGV session', async () => {
  const { rootModel: root } = getPluginManager()
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Linear Genome View'))
  expect(root.session!.views.length).toBeGreaterThan(0)
}, 10000)

test('Add new SV Inspector session', async () => {
  const { rootModel: root } = getPluginManager()
  const { findByText } = render(
    <StartScreen rootModel={root} onFactoryReset={factoryReset} />,
  )
  await findByText('Start a new session')
  fireEvent.click(await findByText('Structural Variant Inspector'))
  expect(root.session!.views.length).toBeGreaterThan(0)
}, 10000)
