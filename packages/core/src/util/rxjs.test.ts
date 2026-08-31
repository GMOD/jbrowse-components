import { Observable, firstValueFrom, lastValueFrom, of, toArray } from 'rxjs'

import { isAbortException } from './aborting.ts'
import { ObservableCreate, subscribeToObservable } from './rxjs.ts'
import { stopStopToken } from './stopToken.ts'

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (e: unknown) => e,
  )

describe('ObservableCreate', () => {
  it('delivers values and completes', async () => {
    const values = await lastValueFrom(
      ObservableCreate<number>(observer => {
        observer.next(1)
        observer.next(2)
        observer.complete()
      }).pipe(toArray()),
    )
    expect(values).toEqual([1, 2])
  })

  it('routes a thrown error and a rejected promise to the subscriber', async () => {
    await expect(
      firstValueFrom(
        ObservableCreate<number>(() => {
          throw new Error('sync boom')
        }),
      ),
    ).rejects.toThrow('sync boom')
    await expect(
      firstValueFrom(
        ObservableCreate<number>(async () => {
          await Promise.resolve()
          throw new Error('async boom')
        }),
      ),
    ).rejects.toThrow('async boom')
  })

  // the stop token used to be accepted and discarded, so every adapter passing
  // opts.stopToken looked cancellable and was not
  it('errors with an abort error when the token is stopped mid-flight', async () => {
    const stopToken = 'rxjs-mid-flight'
    const promise = lastValueFrom(
      ObservableCreate<number>(observer => {
        observer.next(1)
        // never completes on its own
      }, stopToken).pipe(toArray()),
    )
    stopStopToken(stopToken)
    expect(isAbortException(await rejection(promise))).toBe(true)
  })

  it('errors immediately for an already-stopped token, without running func', async () => {
    const stopToken = 'rxjs-already-stopped'
    stopStopToken(stopToken)
    const func = jest.fn()
    expect(
      isAbortException(
        await rejection(
          firstValueFrom(ObservableCreate<number>(func, stopToken)),
        ),
      ),
    ).toBe(true)
    expect(func).not.toHaveBeenCalled()
  })

  it('leaves a completed observable alone when the token stops afterwards', async () => {
    const stopToken = 'rxjs-after-complete'
    const values = await lastValueFrom(
      ObservableCreate<number>(observer => {
        observer.next(1)
        observer.complete()
      }, stopToken).pipe(toArray()),
    )
    stopStopToken(stopToken)
    expect(values).toEqual([1])
  })
})

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
  // unhandled-error hook, not to the subscriber's `error`. So a throw in a
  // per-item parser used to resolve as success, with the items silently
  // missing — the blank-but-fully-"loaded" track plugin-maf kept having to
  // diagnose before this existed.
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
