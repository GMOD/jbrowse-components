import { Observable, Observer } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { observeAbortSignal } from '.'

/**
 * Wrapper for rxjs Observable.create with improved error handling and
 * aborting support
 * @param {function} func observer function, could be async
 */
export function ObservableCreate<T>(
  func: (arg: Observer<T>) => void | Promise<void>,
  signal?: AbortSignal,
): Observable<T> {
  return Observable.create((observer: Observer<T>) => {
    try {
      const ret = func(observer)
      // catch async errors
      if (ret && ret.catch) {
        ret.catch((error: Error) => observer.error(error))
      }
    } catch (error) {
      // catch sync errors
      observer.error(error)
    }
  }).pipe(takeUntil(observeAbortSignal(signal)))
}
