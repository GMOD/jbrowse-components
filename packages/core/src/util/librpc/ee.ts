type Listener = (arg: unknown) => void

export default class EventEmitter {
  events: Record<string, Listener[]> = {}

  on(event: string, listener: Listener) {
    let listeners = this.events[event]
    if (!listeners) {
      listeners = []
      this.events[event] = listeners
    }
    listeners.push(listener)
    return this
  }

  off(event: string, listener: Listener) {
    const listeners = this.events[event]
    if (listeners) {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) {
        listeners.splice(idx, 1)
      }
    }
    return this
  }

  emit(event: string, data: unknown) {
    const listeners = this.events[event]
    if (listeners) {
      for (const listener of listeners) {
        listener(data)
      }
    }
    return this
  }
}
