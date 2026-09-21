import { destroy, types } from '@jbrowse/mobx-state-tree'

import { takeFollowAnchor } from './stackMove.ts'

describe('takeFollowAnchor', () => {
  // a real node, because `release` guards on the liveness of what it WRITES
  const HostModel = types
    .model({
      followSynteny: types.boolean,
      followAnchorIndex: types.number,
      views: types.array(types.model({ name: types.string })),
    })
    .actions(self => ({
      setFollowAnchorIndex(idx: number) {
        self.followAnchorIndex = idx
      },
      holdFollowAnchor<T>(fn: () => T) {
        return fn()
      },
      removeRow(idx: number) {
        self.views.splice(idx, 1)
        self.followAnchorIndex = Math.min(
          Math.max(self.followAnchorIndex, 0),
          Math.max(self.views.length - 1, 0),
        )
      },
    }))
  const host = (followSynteny: boolean, followAnchorIndex: number, rows = 4) =>
    HostModel.create({
      followSynteny,
      followAnchorIndex,
      views: Array.from({ length: rows }, (_, i) => ({ name: `row${i}` })),
    })

  it('takes the anchor for a followed row that does not hold it', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1)

    expect(anchor.taken).toBe(true)
    expect(h.followAnchorIndex).toBe(1)
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  it('takes nothing on the row that already holds it', () => {
    const h = host(true, 1)
    expect(takeFollowAnchor(h, 1).taken).toBe(false)
    expect(h.followAnchorIndex).toBe(1)
  })

  // the anchor is a persisted setting this click never touched, so writing a
  // value back would re-point it at whichever row a mark was last clicked on
  it('takes nothing, and releases nothing, with the follow off', () => {
    const h = host(false, 0)
    const anchor = takeFollowAnchor(h, 1)
    expect(anchor.taken).toBe(false)

    h.setFollowAnchorIndex(2)
    anchor.release()
    expect(h.followAnchorIndex).toBe(2)
  })

  // snackbars stack: an older one's cleanup must not drag the anchor off a row
  // a later click moved it to
  it('releases nothing once a later take has moved the anchor on', () => {
    const h = host(true, 0)
    const first = takeFollowAnchor(h, 1)
    const second = takeFollowAnchor(h, 2)

    first.release()
    expect(h.followAnchorIndex).toBe(2)
    second.release()
    expect(h.followAnchorIndex).toBe(1)
  })

  // a removal renumbers the rows, so the original `row` stops naming ours
  it('still releases after a removal renumbered the anchored row', () => {
    const h = host(true, 0, 3)
    const anchor = takeFollowAnchor(h, 2)
    expect(h.followAnchorIndex).toBe(2)

    h.removeRow(0)
    expect(h.followAnchorIndex).toBe(1)
    expect(h.views[1]!.name).toBe('row2')

    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  it('releases nothing once the anchored row is gone', () => {
    const h = host(true, 0, 3)
    const anchor = takeFollowAnchor(h, 2)

    h.removeRow(2)
    anchor.release()
    expect(h.followAnchorIndex).toBe(1)
  })

  it('is idempotent', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1)
    anchor.release()
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  // the guard is on the HOST, the node release writes. Given the navigated
  // row's liveness instead, the exit that most needs releasing — the row died
  // mid-flight, while the view holding the anchor did not — read false and kept
  // the anchor on a row nobody chose.
  it('does not write once the host itself is gone', () => {
    const dead = host(true, 0)
    const anchor = takeFollowAnchor(dead, 1)
    destroy(dead)
    expect(() => {
      anchor.release()
    }).not.toThrow()
  })
})
