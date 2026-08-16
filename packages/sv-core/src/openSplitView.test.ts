import { openDefaultTracks } from './openSplitView.ts'

function panel() {
  const shown: string[] = []
  return { shown, showTrack: (id: string) => shown.push(id) }
}

test('every panel gets every default track', () => {
  const a = panel()
  const b = panel()
  openDefaultTracks([a, b], ['calls', 'genes'])
  expect(a.shown).toEqual(['calls', 'genes'])
  expect(b.shown).toEqual(['calls', 'genes'])
})

test('no ids is not an error', () => {
  const a = panel()
  openDefaultTracks([a])
  expect(a.shown).toEqual([])
})

// showTrack throws on an id the session cannot resolve, and a launcher's stale
// default should not cost the reader the view they asked for
test('one unresolvable id does not stop the rest', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const shown: string[] = []
  const view = {
    showTrack: (id: string) => {
      if (id === 'gone') {
        throw new Error('Could not resolve identifier')
      }
      shown.push(id)
    },
  }
  expect(() => {
    openDefaultTracks([view], ['gone', 'calls'])
  }).not.toThrow()
  expect(shown).toEqual(['calls'])
})
