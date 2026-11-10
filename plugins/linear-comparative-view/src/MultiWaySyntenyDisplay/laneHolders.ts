import { isAlive } from '@jbrowse/mobx-state-tree'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const holdersBySession = new WeakMap<object, Map<string, number>>()
const heldByDisplay = new WeakMap<
  object,
  { session: AbstractSessionModel; names: Set<string> }
>()

/**
 * Counts `display` among the holders of the temporary assembly `name`. Two
 * displays can share a lane, so the last holder to let go removes it.
 */
export function holdLaneAssembly(
  display: object,
  session: AbstractSessionModel,
  name: string,
) {
  const holders = holdersBySession.get(session) ?? new Map<string, number>()
  holdersBySession.set(session, holders)
  const held = heldByDisplay.get(display) ?? { session, names: new Set() }
  heldByDisplay.set(display, held)
  if (!held.names.has(name)) {
    held.names.add(name)
    holders.set(name, (holders.get(name) ?? 0) + 1)
  }
}

export function releaseLaneAssembly(display: object, name: string) {
  const held = heldByDisplay.get(display)
  if (held?.names.delete(name)) {
    const holders = holdersBySession.get(held.session)!
    const rest = (holders.get(name) ?? 1) - 1
    if (rest > 0) {
      holders.set(name, rest)
    } else {
      holders.delete(name)
      if (isAlive(held.session)) {
        held.session.removeTemporaryAssembly?.(name)
      }
    }
  }
}

export function releaseLaneAssemblies(display: object) {
  for (const name of [...(heldByDisplay.get(display)?.names ?? [])]) {
    releaseLaneAssembly(display, name)
  }
}
