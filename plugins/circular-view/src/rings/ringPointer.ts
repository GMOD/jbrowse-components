import type { RingHostModel } from './ringHost.ts'

/**
 * Hands a pointer over a ring to the ring display's own chrome, which
 * hit-tests, hovers and selects exactly as it does in a linear genome view.
 *
 * The chrome measures the pointer against its container's box, so the strip
 * is moved to put the unwarped strip point under the real client point and
 * the event carries the real client coordinates: the chrome reads the strip
 * x and y off the box, and the tooltip anchors where the cursor is. A strip
 * is hidden, and a hidden element still has a box and still takes a
 * dispatched event.
 */
export class RingPointer {
  private hovered: string | undefined

  constructor(private host: RingHostModel) {}

  private chromeOf(displayId: string) {
    const strip = this.host.stripElements.get(displayId)
    return strip
      ? {
          strip,
          chrome: strip.querySelector('[data-display-id]') ?? strip,
        }
      : undefined
  }

  private dispatch(
    chrome: Element,
    type: 'mousemove' | 'click',
    clientX: number,
    clientY: number,
  ) {
    chrome.dispatchEvent(
      new MouseEvent(type, {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      }),
    )
  }

  /**
   * Route a pointer at `clientX`/`clientY`, `dx`/`dy` CSS px from the circle's
   * centre in the screen frame, over a root whose box is `root`.
   */
  move(
    clientX: number,
    clientY: number,
    dx: number,
    dy: number,
    root: DOMRect,
    type: 'mousemove' | 'click' = 'mousemove',
  ) {
    const hit = this.host.ringHit(dx, dy)
    const id = hit?.ring.display.id
    if (this.hovered !== undefined && this.hovered !== id) {
      this.leave()
    }
    if (!hit || id === undefined) {
      return false
    }
    const target = this.chromeOf(id)
    if (!target) {
      return false
    }
    const { strip, chrome } = target
    strip.style.left = `${clientX - hit.x - root.left}px`
    strip.style.top = `${clientY - hit.y - root.top}px`
    this.hovered = id
    this.dispatch(chrome, type, clientX, clientY)
    return true
  }

  /**
   * React derives `onMouseLeave` from `mouseout` and its `relatedTarget`, so
   * the leave is a `mouseout` bound for the strip's wrapper: the wrapper is
   * the common ancestor, and the chrome alone is left.
   */
  leave() {
    const id = this.hovered
    this.hovered = undefined
    if (id !== undefined) {
      const target = this.chromeOf(id)
      if (target) {
        target.chrome.dispatchEvent(
          new MouseEvent('mouseout', {
            bubbles: true,
            cancelable: true,
            relatedTarget: target.strip,
          }),
        )
      }
    }
  }
}
