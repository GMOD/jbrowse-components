import type { LinearGenomeViewTrack } from './model.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { IsAny } from '@jbrowse/core/util/types'

// Typecheck-only: a plugin union reads as `any` unless `pluggableMstType` names
// what its members are, and `any` here unchecks every track and display read.
test('a view track and its displays are typed', () => {
  const pins: [
    IsAny<LinearGenomeViewTrack>,
    IsAny<LinearGenomeViewTrack['activeDisplay']>,
    IsAny<LinearGenomeViewTrack['displays'][number]>,
    IsAny<BaseTrackModel['displays'][number]>,
  ] = [false, false, false, false]
  expect(pins).toEqual([false, false, false, false])
})
