import { copyTrackSnapshot } from './copyTrackSnapshot.ts'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

function copy(conf: Record<string, unknown>) {
  return copyTrackSnapshot(conf as unknown as BaseTrackConfig, {
    clearCategory: false,
  })
}

test('a named track copies under its name', () => {
  expect(copy({ trackId: 'genes', name: 'Genes' }).name).toBe('Genes (copy)')
})

test('an unnamed track copies under its trackId, the name it was shown by', () => {
  expect(copy({ trackId: 'genes' }).name).toBe('genes (copy)')
  expect(copy({ trackId: 'genes', name: '' }).name).toBe('genes (copy)')
})

test('two copies of a track made in the same millisecond get distinct ids', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
  const displays = [{ type: 'LinearBasicDisplay', displayId: 'x' }]
  const first = copy({ trackId: 'genes', displays })
  const second = copy({ trackId: 'genes', displays })
  now.mockRestore()
  expect(first.trackId).not.toBe(second.trackId)
  expect(first.displays?.[0]?.displayId).not.toBe(
    second.displays?.[0]?.displayId,
  )
})
