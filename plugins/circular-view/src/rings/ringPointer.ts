import type { RingHostModel } from './ringHost.ts'

export type RingPointerEvent = 'mousemove' | 'click' | 'contextmenu'

/**
 * Hands a pointer over a ring to the ring display's own handlers, which
 * hit-test, hover, select and open their menu exactly as in a linear genome
 * view.
 *
 * The strip is moved to put the unwarped strip point under the real client
 * point, and the event carries the real client coordinates: the display reads
 * the strip x and y off its own box, and a tooltip or menu anchors where the
 * cursor is. A hidden element still has a box and still takes a dispatched
 * event.
 *
 * The event goes to the canvas the ring samples, so a display listening on its
 * canvas hears it and one listening on its chrome hears it bubble.
 */
export class RingPointer {
  private hovered: string | undefined

  constructor(private host: RingHostModel) {}

  private targetOf(displayId: string) {
    const strip = this.host.stripElements.get(displayId)
    return strip
      ? {
          strip,
          target:
            strip.querySelector('canvas') ??
            strip.querySelector('[data-display-id]') ??
            strip,
        }
      : undefined
  }

  /**
   * Route a pointer at `clientX`/`clientY`, `dx`/`dy` CSS px from the circle's
   * centre in the screen frame, over a root whose box is `root`. Undefined off
   * every ring, else whether the display left the event uncancelled.
   */
  move(
    clientX: number,
    clientY: number,
    dx: number,
    dy: number,
    root: DOMRect,
    type: RingPointerEvent = 'mousemove',
  ) {
    const hit = this.host.ringHit(dx, dy)
    const id = hit?.ring.display.id
    if (this.hovered !== undefined && this.hovered !== id) {
      this.leave()
    }
    const found = id === undefined ? undefined : this.targetOf(id)
    if (!hit || !found) {
      return undefined
    }
    const { strip, target } = found
    strip.style.left = `${clientX - hit.x - root.left}px`
    strip.style.top = `${clientY - hit.y - root.top}px`
    this.hovered = id
    return target.dispatchEvent(
      new MouseEvent(type, {
        clientX,
        clientY,
        button: type === 'contextmenu' ? 2 : 0,
        bubbles: true,
        cancelable: true,
      }),
    )
  }

  /**
   * React derives `onMouseLeave` from `mouseout` and its `relatedTarget`, so
   * the leave is a `mouseout` bound for the strip's wrapper: the wrapper is
   * the common ancestor, and everything between it and the target is left.
   */
  leave() {
    const id = this.hovered
    this.hovered = undefined
    const found = id === undefined ? undefined : this.targetOf(id)
    found?.target.dispatchEvent(
      new MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true,
        relatedTarget: found.strip,
      }),
    )
  }
}
