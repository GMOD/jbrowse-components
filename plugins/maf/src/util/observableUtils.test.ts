import { Observable, of } from 'rxjs'

import { subscribeToObservable } from './observableUtils.ts'

describe('subscribeToObservable', () => {
  it('resolves after every item on the happy path', async () => {
    const seen: number[] = []
    await subscribeToObservable(of(1, 2, 3), n => {
      seen.push(n)
    })
    expect(seen).toEqual([1, 2, 3])
  })

  it('rejects when the source errors', async () => {
    await expect(
      subscribeToObservable(
        new Observable<number>(o => {
          o.error(new Error('source failed'))
        }),
        () => {},
      ),
    ).rejects.toThrow('source failed')
  })

  // Regression: rxjs sends an exception out of a `next` handler to its global
  // unhandled-error hook, not to the subscriber's `error`. So a parse failure
  // in any of this plugin's six per-feature callbacks used to resolve as
  // success, with the features silently missing — the blank-but-loaded track
  // this plugin keeps having to diagnose.
  it('rejects when the item handler throws, and stops feeding it', async () => {
    const seen: number[] = []
    await expect(
      subscribeToObservable(of(1, 2, 3), n => {
        seen.push(n)
        if (n === 2) {
          throw new Error('bad feature')
        }
      }),
    ).rejects.toThrow('bad feature')
    expect(seen).toEqual([1, 2])
  })

  // The synchronous case above cannot unsubscribe (the subscription object does
  // not exist yet while `of` is still emitting), so the guard carries it. An
  // asynchronous source is unsubscribed for real and stops producing.
  it('unsubscribes an async source on the first throw', async () => {
    let unsubscribed = false
    let emitted = 0
    const source = new Observable<number>(o => {
      const timer = setInterval(() => {
        emitted++
        o.next(emitted)
      }, 1)
      return () => {
        unsubscribed = true
        clearInterval(timer)
      }
    })
    await expect(
      subscribeToObservable(source, () => {
        throw new Error('bad feature')
      }),
    ).rejects.toThrow('bad feature')
    expect(unsubscribed).toBe(true)
    expect(emitted).toBe(1)
  })
})
