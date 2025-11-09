import { checkStopToken } from './stopToken'
/**
 * Iterates over an iterable with periodic stop token checks to allow for cancellation.
 *
 * This function provides a way to iterate through large datasets while periodically
 * checking if the operation should be stopped based on a stop token. It balances
 * performance by only checking the stop token after a certain number of iterations
 * and time duration have passed.
 *
 * @template T - The type of elements in the iterable
 * @param iter - The iterable to process
 * @param stopToken - Optional token used to check if the operation should be stopped
 * @param arg - Callback function to execute for each element, receives the element and its index
 * @param durationMs - Time threshold in milliseconds before checking stop token (default: 400)
 * @param iterCheck - Number of iterations between potential stop token checks (default: 10) because querying performance.now super fast is actually slow
 *
 * @throws Will throw an error if the stop token indicates the operation should be cancelled
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5];
 * forEachWithStopTokenCheck(
 *   data,
 *   'my-stop-token',
 *   (item, index) => console.log(`Item ${index}: ${item}`),
 *   500,  // Check every 500ms
 *   5     // Check every 5 iterations
 * );
 * ```
 */
export function forEachWithStopTokenCheck<T>(
  iter: Iterable<T>,
  stopToken: string | undefined,
  arg: (arg: T, idx: number) => void,
  durationMs = 400,
  iterCheck = 10,
) {
  let start = performance.now()
  let i = 0
  for (const t of iter) {
    if ((i + 1) % iterCheck === 0 && performance.now() - start > durationMs) {
      checkStopToken(stopToken)
      start = performance.now()
    }
    arg(t, i++)
  }
}
