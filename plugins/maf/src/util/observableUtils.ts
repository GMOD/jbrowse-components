import type { Observable } from 'rxjs'

/**
 * Subscribes to an observable and returns a promise that resolves when complete.
 * Useful for streaming processing where you want to handle each item as it arrives.
 */
export function subscribeToObservable<T>(
  observable: Observable<T>,
  onNext: (item: T) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    observable.subscribe({
      next: onNext,
      error: reject,
      complete: resolve,
    })
  })
}
