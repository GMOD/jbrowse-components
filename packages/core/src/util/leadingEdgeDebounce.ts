// MobX's built-in `autorun(fn, { delay })` is trailing-edge only: it schedules
// even the initial run through setTimeout, so a cold open waits a full `delay`
// before any work starts — for no interaction to coalesce. That latency lands
// directly on first paint and on render benchmarks.
//
// This scheduler runs immediately until the caller declares itself primed, then
// debounces exactly as `{ delay }` did. `prime()` is the caller's call rather
// than automatic, so runs that bail on a guard (view not initialized yet, data
// not ready) stay on the leading edge instead of arming the debounce for work
// that never happened.
//
//   const debounce = leadingEdgeDebounce(1000)
//   autorun(() => { if (ready) { doWork(); debounce.prime() } }, {
//     scheduler: debounce.scheduler,
//   })
export function leadingEdgeDebounce(delay: number) {
  let primed = false
  return {
    scheduler: (run: () => void) => {
      if (primed) {
        setTimeout(run, delay)
      } else {
        run()
      }
    },
    prime() {
      primed = true
    },
  }
}
