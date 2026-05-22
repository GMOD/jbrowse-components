import { cast, get, set } from './bit.ts'

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
  return (r << OFFSET_R) + (g << OFFSET_G) + (b << OFFSET_B) + (a << OFFSET_A)
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
