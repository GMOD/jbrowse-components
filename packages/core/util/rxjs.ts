import { Observable, Observer } from 'rxjs'

/**
 * Wrapper for rxjs Observable.create with improved error handling
 * @param {function} func observer function, could be async
 */
export function ObservableCreate<T>(func:Function):Observable<T> {
  return Observable.create((observer:Observer<T>) => {
    try {
      const ret = func(observer)
      // catch async errors
      if (ret && ret.catch) ret.catch((error:any) => observer.error(error))
      return ret
    } catch (error) {
      // catch sync errors
      observer.error(error)
    }
    return undefined
  })
}

export function removeme() {}
