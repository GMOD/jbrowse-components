import { Observable, Observer } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { observeAbortSignal } from '.'

/**
 * Wrapper for rxjs Observable.create with improved error handling and
 * aborting support
 * @param func - observer function, could be async
 */
export function ObservableCreate<T>(
  func: (arg: Observer<T>) => void | Promise<void>,
  signal?: AbortSignal,
): Observable<T> {
  return new Observable((observer: Observer<T>) => {
    try {
      const ret = func(observer)
      if (ret?.catch) {
        ret.catch((error: unknown) => {
          observer.error(error)
        })
      }
    } catch (error) {
      observer.error(error)
    }
  }).pipe(takeUntil(observeAbortSignal(signal)))
}
