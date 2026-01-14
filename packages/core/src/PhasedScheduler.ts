/* eslint-disable @typescript-eslint/no-unsafe-function-type */

// helper class that keeps groups of callbacks that are then run in a specified
// order by group
export default class PhasedScheduler<PhaseName extends string> {
  phaseCallbacks = new Map<PhaseName, Function[]>()

  phaseOrder: PhaseName[] = []

  constructor(...phaseOrder: PhaseName[]) {
    this.phaseOrder = phaseOrder
  }

  add(phase: PhaseName, callback: Function) {
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
    for (const phaseName of this.phaseOrder) {
      for (const callback of this.phaseCallbacks.get(phaseName) || []) {
        callback()
      }
    }
  }
}
