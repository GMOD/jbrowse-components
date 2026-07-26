/**
 * An external plugin is loaded by whatever host its config names, including
 * JBrowse releases older than the plugin. SamAdapter arrived after v4.3.0, so
 * "is this host new enough" has to be asked rather than assumed — a result
 * track whose adapter does not resolve is worse than one drawn as plain blocks.
 */
import { types } from '@jbrowse/mobx-state-tree'

import { canRenderAlignments } from './ucscShared.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// canRenderAlignments only reads getEnv().pluginManager, and only calls `has` on
// two registries, so a session is any MST node carrying that env
function sessionWith(registered: string[]) {
  const has = (name: string) => registered.includes(name)
  return types
    .model('TestSession', {})
    .create(
      {},
      { pluginManager: { adapterTypes: { has }, trackTypes: { has } } },
    ) as unknown as AbstractSessionModel
}

const BOTH = ['SamAdapter', 'AlignmentsTrack']

test('renders alignments when the host has both pieces', () => {
  expect(canRenderAlignments(sessionWith(BOTH))).toBe(true)
})

// the release gate: SamAdapter postdates v4.3.0, so a config pointing an old
// hosted build at this plugin lands here
test('falls back when the host predates SamAdapter', () => {
  expect(canRenderAlignments(sessionWith(['AlignmentsTrack']))).toBe(false)
})

// a build with the alignments plugin left out entirely
test('falls back when the host has no alignments track type', () => {
  expect(canRenderAlignments(sessionWith(['SamAdapter']))).toBe(false)
})

test('falls back on a host with neither', () => {
  expect(canRenderAlignments(sessionWith([]))).toBe(false)
})
