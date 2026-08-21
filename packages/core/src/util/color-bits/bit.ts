// Bitwise functions
//
// The color representation would ideally be 32-bits unsigned, but JS bitwise
// operators only work as 32-bits signed. The range of Smi values on V8 is also
// 32-bits signed. Those two factors make it that it's much more efficient to just
// use signed integers to represent the data.
//
// Colors with a R channel >= 0x80 will be a negative number, but that's not really
// an issue at any point because the bits for signed and unsigned integers are always
// the same, only their interpretation changes.

const INT32_TO_UINT32_OFFSET = 2 ** 32

export function cast(n: number) {
  if (n < 0) {
    return n + INT32_TO_UINT32_OFFSET
  }
  return n
}

export function get(n: number, offset: number) {
  return (n >> offset) & 0xff
}

export function set(n: number, offset: number, byte: number) {
  return n ^ ((n ^ (clampByte(byte) << offset)) & (0xff << offset))
}

// CSS clamps an out-of-range channel and this composition cannot: `<<` wraps,
// and `newColor`'s `+` then carries the overflow into the neighbouring channel.
// Unclamped, `rgb(0 0 0 / -20%)` composes to white at 80% rather than to
// transparent black, and `alpha(red, 1.4)` masks 357 down to 101, painting a
// feature at 40% opacity for a caller that asked for more than full. Both
// channel parsers already document a 0..255 result; this is what makes it true.
export function clampByte(n: number) {
  // `> 0` rather than `< 0`, so NaN takes the zero branch: every comparison
  // against NaN is false, and an unclamped NaN shifts to 0 anyway — silently,
  // one channel at a time. `jexl:alpha(color, get(feature,'opacity'))` on a
  // non-numeric attribute is the reachable one, and it drew the feature at
  // alpha 0 instead of reaching the invalid-colour sentinel.
  return n > 0 ? (n > 255 ? 255 : n) : 0
}
