/**
 * fast low-level intersection of 2 coordinate ranges. assumes interbase coordinates.
 *
 * assumes left <= right for both ranges
 *
 * @returns {Array[number]} array of [left, right], or undefined if the ranges do not intersect
 */
export function intersection2(left1, right1, left2, right2) {
  // this code is verbose cause if statements are faster than Math.min and Math.max
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
  return undefined
}

export function doesIntersect2(left1, right1, left2, right2) {
  return right1 > left2 && left1 < right2
}

export function removeme() {} // remove after we have more functions in here
