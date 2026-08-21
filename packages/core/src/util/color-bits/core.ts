import { cast, clampByte, get, set } from './bit.ts'

export type Color = number

export const OFFSET_R = 24
export const OFFSET_G = 16
export const OFFSET_B = 8
export const OFFSET_A = 0

/**
 * Creates a new color from the given RGBA components.
 * Every component should be in the [0, 255] range.
 */
export function newColor(r: number, g: number, b: number, a: number) {
  return (
    (clampByte(r) << OFFSET_R) +
    (clampByte(g) << OFFSET_G) +
    (clampByte(b) << OFFSET_B) +
    (clampByte(a) << OFFSET_A)
  )
}

/**
 * Creates a new color from the given number value, e.g. 0x599eff.
 */
export function from(color: number) {
  return newColor(
    get(color, OFFSET_R),
    get(color, OFFSET_G),
    get(color, OFFSET_B),
    get(color, OFFSET_A),
  )
}

/**
 * Turns the color into its equivalent number representation.
 * This is essentially a cast from int32 to uint32.
 */
export function toNumber(color: Color) {
  return cast(color)
}

// These read the canonical 0xRRGGBBAA layout (R in the HIGH byte). Their
// mirror image is `abgrRed`/`abgrGreen`/`abgrBlue`/`abgrAlpha` in
// ../colorBits.ts, which reads the ABGR u32 the GPU path packs (R in the LOW
// byte) — calling the wrong pair silently swaps R and B. Both take a plain
// number and cannot be told apart by the type system: a branded Color was
// considered and rejected, because ABGR values are read back out of
// Uint32Arrays, where indexing yields `number` and every read would need the
// cast that defeats the brand.
export function getRed(c: Color) {
  return get(c, OFFSET_R)
}
export function getGreen(c: Color) {
  return get(c, OFFSET_G)
}
export function getBlue(c: Color) {
  return get(c, OFFSET_B)
}
export function getAlpha(c: Color) {
  return get(c, OFFSET_A)
}
export function setRed(c: Color, value: number) {
  return set(c, OFFSET_R, value)
}
export function setGreen(c: Color, value: number) {
  return set(c, OFFSET_G, value)
}
export function setBlue(c: Color, value: number) {
  return set(c, OFFSET_B, value)
}
export function setAlpha(c: Color, value: number) {
  return set(c, OFFSET_A, value)
}
