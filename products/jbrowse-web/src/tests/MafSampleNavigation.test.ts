import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'

import { openSampleInNewView } from '../../../../plugins/maf/src/LinearMafDisplay/openSampleInNewView.ts'
import configSnapshot from '../../test_data/volvox/config_maf_navigation.json' with { type: 'json' }
import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager } from './util.tsx'

import type { Sample } from '../../../../plugins/maf/src/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

async function setup() {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const track = rootModel.jbrowse.tracks.find(
    (t: AnyConfigurationModel) =>
      readConfObject(t, 'trackId') === 'volvox_maf_navigable',
  )!
  const samples = readConfObject(track, ['adapter', 'samples']) as Sample[]
  const reported: string[] = []
  getEnv(session).pluginManager.listenToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    ({ assemblyName }) => {
      reported.push(assemblyName)
    },
  )
  return { session, samples, reported }
}

function targetFor(sample: Sample) {
  return {
    assemblyName: sample.assemblyName!,
    assemblyConfigLocation: sample.assemblyConfigLocation,
    chr: 'chrA',
    start: 5489,
    end: 5664,
    sampleLabel: sample.label,
  }
}

test('a sample whose assembly is absent loads it from its own config', async () => {
  const { session, samples, reported } = await setup()
  const simvolvox = samples.find(s => s.id === 'simvolvox')!
  expect(session.assemblyManager.has('simvolvox')).toBe(false)

  await openSampleInNewView(session, 'display1', targetFor(simvolvox))

  // fetched out of the sibling config_maf_nav_targets.json and added, not
  // resolved by asking a plugin where 'simvolvox' might live
  await waitFor(() => {
    expect(session.assemblyManager.has('simvolvox')).toBe(true)
  })
  expect(reported).toEqual([])
  expect(session.views.map((v: { id: string }) => v.id)).toEqual([
    'display1_simvolvox',
  ])
})

test('a sample whose assembly is already in the config is not refetched', async () => {
  const { session, samples, reported } = await setup()
  const volvox = samples.find(s => s.id === 'volvox')!
  expect(volvox.assemblyConfigLocation).toBeUndefined()

  await openSampleInNewView(session, 'display1', targetFor(volvox))

  expect(reported).toEqual([])
  expect(session.views.map((v: { id: string }) => v.id)).toEqual([
    'display1_volvox',
  ])
})

test('samples with no assemblyName carry no navigation target', async () => {
  const { samples } = await setup()
  expect(samples.filter(s => s.assemblyName).map(s => s.id)).toEqual([
    'volvox',
    'simvolvox',
    'minivolvox',
  ])
})
