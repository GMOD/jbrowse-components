// A pointer event a test fires without saying which pointer is the mouse's
// primary one, as in a browser. jsdom's PointerEvent takes the spec's
// dictionary defaults, `pointerType: ''` and `isPrimary: false`, which no real
// pointer has, and a handler that ignores non-primary pointers would ignore
// every `fireEvent.pointerDown` that names none. A test that means a finger or
// a second pointer says so.
//
// jsdom has no pointer-capture API. Capture only decides which element keeps
// receiving the pointer stream, and jsdom delivers events to whatever the test
// targets anyway, so a no-op is faithful enough.
if (typeof window !== 'undefined') {
  const NativePointerEvent = window.PointerEvent
  class PointerEvent extends NativePointerEvent {
    constructor(type, params = {}) {
      super(type, { pointerType: 'mouse', isPrimary: true, ...params })
    }
  }
  window.PointerEvent = PointerEvent
  global.PointerEvent = PointerEvent
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
  }
}
