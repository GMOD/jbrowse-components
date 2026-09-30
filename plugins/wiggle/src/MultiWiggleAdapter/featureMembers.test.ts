import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import BedPlugin from '@jbrowse/plugin-bed'

import WigglePlugin from '../index.ts'

import type MultiWiggleAdapter from './MultiWiggleAdapter.ts'

const volvox = path.resolve(__dirname, '../../../../test_data/volvox')
const hub = path.resolve(__dirname, '../../../../test_data/volvoxhub/bbi')

function local(localPath: string) {
  return { localPath, locationType: 'LocalPathLocation' }
}

const region = { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'v' }

async function stackOf(subadapters: Record<string, unknown>[]) {
  const pm = new PluginManager([new BedPlugin(), new WigglePlugin()])
  pm.createPluggableElements()
  pm.configure()
  const { dataAdapter } = await getAdapter(pm, 'test', {
    type: 'MultiWiggleAdapter',
    subadapters,
  })
  return dataAdapter as MultiWiggleAdapter
}

function bigBed(localPath: string) {
  return { type: 'BigBedAdapter', bigBedLocation: local(localPath) }
}

function bedTabix(localPath: string) {
  return {
    type: 'BedTabixAdapter',
    bedGzLocation: local(localPath),
    index: { location: local(`${localPath}.tbi`), indexType: 'TBI' },
  }
}

test('names BigBed members from their paths and keeps their ids apart', async () => {
  const adapter = await stackOf([
    bigBed(`${volvox}/volvox.bb`),
    bigBed(`${hub}/volvox.bb`),
  ])
  const features = await adapter.getFeaturesArray(region)
  const sources = [...new Set(features.map(f => f.get('source')))]
  expect(sources).toEqual(['volvox/volvox', 'bbi/volvox'])
  expect(new Set(features.map(f => f.id())).size).toBe(features.length)
})

test('stamps each member name on a BED member configured with a source', async () => {
  const adapter = await stackOf([
    {
      type: 'BedAdapter',
      bedLocation: local(`${volvox}/volvox_repeat_plus.bed`),
      source: 'plus',
    },
    {
      type: 'BedAdapter',
      bedLocation: local(`${volvox}/volvox_repeat_minus.bed`),
    },
  ])
  const features = await adapter.getFeaturesArray(region)
  expect(new Set(features.map(f => f.get('source')))).toEqual(
    new Set(['plus', 'volvox_repeat_minus']),
  )
})

test('sums the byte estimates of the members that give one', async () => {
  const one = await stackOf([bedTabix(`${volvox}/volvox-bed12.bed.gz`)])
  const single = await one.getRegionByteSize([region])
  expect(single).toBeGreaterThan(0)

  const stack = await stackOf([
    bedTabix(`${volvox}/volvox-bed12.bed.gz`),
    bigBed(`${volvox}/volvox.bb`),
    {
      type: 'BedAdapter',
      bedLocation: local(`${volvox}/volvox_repeat_plus.bed`),
    },
  ])
  const bigBedSize = await (
    await stackOf([bigBed(`${volvox}/volvox.bb`)])
  ).getRegionByteSize([region])
  expect(await stack.getRegionByteSize([region])).toBe(single! + bigBedSize!)
})

test('gives no estimate when no member estimates', async () => {
  const adapter = await stackOf([
    {
      type: 'BedAdapter',
      bedLocation: local(`${volvox}/volvox_repeat_plus.bed`),
    },
  ])
  expect(await adapter.getRegionByteSize([region])).toBeUndefined()
})
