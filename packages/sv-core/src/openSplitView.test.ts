import { openDefaultTracks } from './openSplitView.ts'

function panel() {
  const shown: string[] = []
  return {
    shown,
    launchTrack: async (id: string) => shown.push(id),
  }
}

test('every panel gets every default track', async () => {
  const a = panel()
  const b = panel()
  await openDefaultTracks([a, b], ['calls', 'genes'])
  expect(a.shown).toEqual(['calls', 'genes'])
  expect(b.shown).toEqual(['calls', 'genes'])
})

test('no ids is not an error', async () => {
  const a = panel()
  await openDefaultTracks([a])
  expect(a.shown).toEqual([])
})

// launchTrack rejects on an id the session cannot resolve, and a launcher's
// stale default should not cost the reader the view they asked for
test('one unresolvable id does not stop the rest', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const shown: string[] = []
  const view = {
    launchTrack: async (id: string) => {
      if (id === 'gone') {
        throw new Error('Could not resolve identifier')
      }
      shown.push(id)
    },
  }
  await expect(
    openDefaultTracks([view], ['gone', 'calls']),
  ).resolves.not.toThrow()
  expect(shown).toEqual(['calls'])
})
