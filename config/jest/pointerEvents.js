// jsdom implements neither the PointerEvent constructor nor the pointer-capture
// API, so any component driven by a pointer drag (usePointerDrag,
// VerticalScrollbar, the dotplot interaction) is untestable without these:
//
// - With no `PointerEvent` global, testing-library's fireEvent.pointerMove
//   falls back to a plain Event, which carries no clientX/clientY — handlers
//   read undefined coordinates and the assertions come out NaN. Extending
//   MouseEvent gives the coordinate properties for free.
// - setPointerCapture only decides which element keeps receiving the pointer
//   stream, and jsdom delivers events to whatever the test targets anyway, so
//   a no-op is faithful enough.
if (typeof window !== 'undefined') {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      constructor(type, params = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 0
        this.pointerType = params.pointerType ?? 'mouse'
        this.isPrimary = params.isPrimary ?? true
        this.pressure = params.pressure ?? 0
        this.width = params.width ?? 1
        this.height = params.height ?? 1
      }
    }
    window.PointerEvent = PointerEvent
    global.PointerEvent = PointerEvent
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
  }
}
