import { TextDecoder as NodeTextDecoder, TextEncoder } from 'util'

// jsdom ships neither, so both come from node. TextEncoder is a straight
// substitution; TextDecoder is not, and the difference is load-bearing.
//
// Node's TextDecoder accepts a view over a **resizable** ArrayBuffer. Chrome's
// throws. That matters here because `@gmod/bgzf-filehandle` decompresses through
// an inlined wasm module, and a WebAssembly.Memory buffer IS resizable — so a
// decompress path that hands back a view into the wasm heap rather than a copy
// works in every test and breaks in the browser, with a TypeError raised inside
// an RPC worker where it arrives without a stack.
//
// Substituting node's decoder unchanged makes the whole suite blind to that,
// across every adapter that reads bgzf (BAM, CRAM, tabix, bbi). So the shim
// enforces the browser's rule instead of the platform's.
class TextDecoder extends NodeTextDecoder {
  decode(input, options) {
    const buffer = ArrayBuffer.isView(input) ? input.buffer : input
    // `resizable` on ArrayBuffer, `growable` on SharedArrayBuffer; both are
    // undefined on older buffers and on a plain Uint8Array over a normal one.
    if (buffer?.resizable || buffer?.growable) {
      throw new TypeError(
        "Failed to execute 'decode' on 'TextDecoder': The provided ArrayBuffer value must not be resizable",
      )
    }
    return super.decode(input, options)
  }
}

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
