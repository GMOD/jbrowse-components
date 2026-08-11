import { act, renderHook } from '@testing-library/react'

import { useStickyQueue } from './useStickyQueue.ts'

interface Entry {
  name: string
}

const es = (...names: string[]) => names.map(name => ({ name }))
const nameList = (list: Entry[]) => list.map(e => e.name)

function setup(entries: Entry[], matching: Entry[], viewKey = 'v1') {
  return renderHook(
    (props: { entries: Entry[]; matching: Entry[]; viewKey: string }) =>
      useStickyQueue(props),
    { initialProps: { entries, matching, viewKey } },
  )
}

test('the queue is the query as it was when the view was entered', () => {
  const entries = es('a', 'b', 'c')
  const { result, rerender } = setup(entries, entries)
  expect(nameList(result.current.queue)).toEqual(['a', 'b', 'c'])

  // 'b' was just approved, so the live query no longer selects it
  rerender({ entries, matching: es('a', 'c'), viewKey: 'v1' })
  expect(nameList(result.current.queue)).toEqual(['a', 'b', 'c'])
  expect([...result.current.leaving]).toEqual(['b'])
})

test('a settled card keeps its place under a sort that would move it', () => {
  const entries = es('a', 'b', 'c')
  const { result, rerender } = setup(entries, entries)
  // 'recently reviewed' puts the card just acted on first — the reordering that
  // teleports it away from the reviewer mid-note
  rerender({ entries, matching: es('b', 'a', 'c'), viewKey: 'v1' })
  expect(nameList(result.current.queue)).toEqual(['a', 'b', 'c'])
})

test('refresh takes the query again, dropping what settled', () => {
  const entries = es('a', 'b', 'c')
  const { result, rerender } = setup(entries, entries)
  rerender({ entries, matching: es('a', 'c'), viewKey: 'v1' })
  act(() => {
    result.current.refresh()
  })
  expect(nameList(result.current.queue)).toEqual(['a', 'c'])
  expect(result.current.leaving.size).toBe(0)
})

test('dismiss drops one card without disturbing the rest', () => {
  const entries = es('a', 'b', 'c')
  const { result } = setup(entries, entries)
  act(() => {
    result.current.dismiss('b')
  })
  expect(nameList(result.current.queue)).toEqual(['a', 'c'])
})

test('a new viewKey re-queries — the reviewer asked a different question', () => {
  const entries = es('a', 'b', 'c')
  const { result, rerender } = setup(entries, entries)
  act(() => {
    result.current.dismiss('a')
  })
  rerender({ entries, matching: es('b', 'c'), viewKey: 'v2' })
  expect(nameList(result.current.queue)).toEqual(['b', 'c'])
})

test('the first capture is empty until the data arrives, so the key carries it', () => {
  const { result, rerender } = setup([], [], 'gen0 needs')
  expect(result.current.queue).toEqual([])
  const entries = es('a', 'b')
  // a bare rerender with data would leave the empty capture standing; the epoch
  // in the key is what makes the arrival a new question
  rerender({ entries, matching: entries, viewKey: 'gen0 needs' })
  expect(result.current.queue).toEqual([])
  rerender({ entries, matching: entries, viewKey: 'gen1 needs' })
  expect(nameList(result.current.queue)).toEqual(['a', 'b'])
})

test('pending counts what the query has found since the capture', () => {
  const entries = es('a', 'b', 'c')
  const { result, rerender } = setup(entries, es('a'))
  expect(result.current.pending).toBe(0)
  // the drift pass finished deciding about 'b' and 'c', so the live query now
  // selects them — but the reviewer's list is still the one they asked for
  rerender({ entries, matching: entries, viewKey: 'v1' })
  expect(nameList(result.current.queue)).toEqual(['a'])
  expect(result.current.pending).toBe(2)
  act(() => {
    result.current.refresh()
  })
  expect(nameList(result.current.queue)).toEqual(['a', 'b', 'c'])
  expect(result.current.pending).toBe(0)
})

test('a settled card is not pending — it is already on the list', () => {
  const entries = es('a', 'b')
  const { result, rerender } = setup(entries, entries)
  rerender({ entries, matching: es('a'), viewKey: 'v1' })
  expect([...result.current.leaving]).toEqual(['b'])
  expect(result.current.pending).toBe(0)
})

test('a captured name the data no longer has drops out', () => {
  const entries = es('a', 'b')
  const { result, rerender } = setup(entries, entries)
  rerender({ entries: es('a'), matching: es('a'), viewKey: 'v1' })
  expect(nameList(result.current.queue)).toEqual(['a'])
  expect(result.current.leaving.size).toBe(0)
})
