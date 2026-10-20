import { types } from '@jbrowse/mobx-state-tree'

import { persistTrackConfigNow } from './mstUtils.ts'

const Leaf = types.model('Leaf', {})

test('saves the track holding the node', () => {
  let saves = 0
  const track = types
    .model('Track', {
      configuration: types.frozen({ trackId: 't1' }),
      leaf: Leaf,
    })
    .actions(() => ({
      persistConfigurationNow() {
        saves++
      },
    }))
    .create({ leaf: {} })
  persistTrackConfigNow(track.leaf)
  expect(saves).toBe(1)
})

test('does nothing for a node with a parent but no track above it', () => {
  const root = types.model('Root', { leaf: Leaf }).create({ leaf: {} })
  expect(() => {
    persistTrackConfigNow(root.leaf)
  }).not.toThrow()
  persistTrackConfigNow(Leaf.create())
})
