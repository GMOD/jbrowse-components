import { Observable, Observer } from 'rxjs'

/**
 * Wrapper for rxjs Observable.create with improved error handling
 * @param {function} func observer function, could be async
 */
export function ObservableCreate<T>(
  func: (arg: Observer<T>) => void | Promise<void>,
): Observable<T> {
  return Observable.create(function observableCreator(observer: Observer<T>) {
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
  })
}
