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
