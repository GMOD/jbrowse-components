import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('multi-way LinearSyntenyView init routes tracks to per-level slots', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // 3 assemblies — so 2 levels (between views[0]/[1] and views[1]/[2]).
  // volvox_del.paf maps volvox_del↔volvox  → level 0
  // volvox_ins.paf maps volvox↔volvox_ins  → level 1
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox_del' },
        { assembly: 'volvox' },
        { assembly: 'volvox_ins' },
      ],
      tracks: [['volvox_del.paf'], ['volvox_ins.paf']],
    },
  })

  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.views.length).toBe(3)
  expect(view.levels.length).toBe(2)

  // The fix: each PAF lands at its correct level rather than both at level 0.
  expect(view.levels[0]?.tracks.length).toBe(1)
  expect(view.levels[1]?.tracks.length).toBe(1)
  expect(view.levels[0]?.tracks[0]?.configuration.trackId).toBe(
    'volvox_del.paf',
  )
  expect(view.levels[1]?.tracks[0]?.configuration.trackId).toBe(
    'volvox_ins.paf',
  )

  expect(view.init).toBeUndefined()
}, 40000)
