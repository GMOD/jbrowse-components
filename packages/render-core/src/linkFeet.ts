export const LINK_FOOT_FORWARD = 1
export const LINK_FOOT_REVERSE = 2

/** The `feet` lane's value for a tick at each foot, by genomic direction. */
export function linkFeet(xDir: number, x2Dir: number) {
  const bits = (d: number) =>
    d > 0 ? LINK_FOOT_FORWARD : d < 0 ? LINK_FOOT_REVERSE : 0
  return bits(xDir) | (bits(x2Dir) << 2)
}
