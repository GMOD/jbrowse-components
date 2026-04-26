type Callback = () => void

// helper class that keeps groups of callbacks that are then run in a specified
// order by group
export default class PhasedScheduler<PhaseName extends string> {
  phaseCallbacks = new Map<PhaseName, Callback[]>()

  phaseOrder: PhaseName[] = []

  constructor(...phaseOrder: PhaseName[]) {
    this.phaseOrder = phaseOrder
  }

  add(phase: PhaseName, callback: Callback) {
    if (!this.phaseOrder.includes(phase)) {
      throw new Error(`unknown phase ${phase}`)
    }
    let phaseCallbacks = this.phaseCallbacks.get(phase)
    if (!phaseCallbacks) {
      phaseCallbacks = []
      this.phaseCallbacks.set(phase, phaseCallbacks)
    }
    phaseCallbacks.push(callback)
  }

  run() {
    const errors: unknown[] = []
    for (const phaseName of this.phaseOrder) {
      for (const callback of this.phaseCallbacks.get(phaseName) || []) {
        try {
          callback()
        } catch (e) {
          errors.push(e)
        }
      }
    }
    this.phaseCallbacks.clear()
    if (errors.length) {
      throw new AggregateError(
        errors,
        'Errors during pluggable element creation',
      )
    }
  }
}
