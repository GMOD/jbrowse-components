import { firstValueFrom, lastValueFrom, toArray } from 'rxjs'

import { isAbortException } from './aborting.ts'
import { ObservableCreate } from './rxjs.ts'
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
