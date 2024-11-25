import { Observable } from 'rxjs'
import type { Observer } from 'rxjs'

/**
 * Wrapper for rxjs Observable.create with improved error handling and
 * aborting support
 * @param func - observer function, could be async
 * TODO:ABORTING?
 */
export function ObservableCreate<T>(
  func: (arg: Observer<T>) => void | Promise<void>,
  _stopToken?: string,
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
  })
}
