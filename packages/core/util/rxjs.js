import { Observable } from 'rxjs'

/**
 * Wrapper for rxjs Observable.create with improved error handling
 * @param {function} func observer function, could be async
 */
export function ObservableCreate(func) {
  return Observable.create(observer => {
    try {
      const ret = func(observer)
      // catch async errors
      if (ret && ret.catch) ret.catch(error => observer.error(error))
      return ret
    } catch (error) {
      // catch sync errors
      observer.error(error)
    }
    return undefined
  })
}
