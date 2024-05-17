/**
 * fast low-level intersection of 2 coordinate ranges. assumes interbase coordinates.
 *
 * assumes `left <= right` for both ranges
 *
 * @returns array of [left, right], or [] if the ranges do not intersect. the choice of [] is because it allows destructuring array assignment without check for undefined return
 */
export function intersection2(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
): [number, number] | [] {
  // this code is verbose because "if" statements are faster than Math.min and Math.max
  if (right1 > left2 && left1 < right2 && right2 - left2 && right1 - left1) {
    if (left1 > left2) {
      if (right1 < right2) {
        // 1     |-------|
        //     |------------|
        return [left1, right1]
      }
      // 2         |----|
      //      |------|
      return [left1, right2]
    }
    if (right1 < right2) {
      // 3  |-----|
      //       |------|
      return [left2, right1]
    }
    // 4     |------------|
    //         |-------|
    return [left2, right2]
  }
  return []
}

/**
 * Return whether 2 interbase coordinate ranges intersect.
 *
 * @param left1 -
 * @param right1 -
 * @param left2 -
 * @param right2 -
 *
 * @returns true if the two ranges intersect
 */
export function doesIntersect2(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
) {
  return right1 > left2 && left1 < right2
}

/**
 * Return whether the first region is completely contained within the second region
 *
 * @param left1 - candidate inner region left
 * @param right1 - candidate inner region right
 * @param left2 - candidate outer region left
 * @param right2 - candidate outer region right
 */
export function isContainedWithin(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
) {
  return left2 <= left1 && right2 >= right1
}
