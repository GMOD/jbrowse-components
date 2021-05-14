function findCircleIntersectionX(
  y: number,
  cx: number,
  cy: number,
  r: number,
  resultArray: [number, number][],
) {
  const d = Math.abs(y - cy)
  if (d > r) {
    return
  }
  if (d === r) {
    resultArray.push([cx, y])
  }
  const solution = Math.sqrt(r * r - d * d)
  resultArray.push([cx - solution, y])
  resultArray.push([cx + solution, y])
}

function findCircleIntersectionY(
  x: number,
  cx: number,
  cy: number,
  r: number,
  resultArray: [number, number][],
) {
  const d = Math.abs(x - cx)
  if (d > r) {
    return
  }
  if (d === r) {
    resultArray.push([x, cy])
  }
  const solution = Math.sqrt(r * r - d * d)
  resultArray.push([x, cy - solution])
  resultArray.push([x, cy + solution])
}

function cartesianToTheta(x: number, y: number) {
  let theta = (Math.atan(y / x) + 2 * Math.PI) % (2 * Math.PI)
  if (x < 0) {
    if (y <= 0) {
      theta += Math.PI
    } else {
      theta -= Math.PI
    }
  }
  return theta
}

export function cartesianToPolar(x: number, y: number) {
  const rho = Math.sqrt(x * x + y * y)
  if (rho === 0) {
    return [0, 0]
  }
  const theta = cartesianToTheta(x, y)
  return [rho, theta]
}

const twoPi = 2 * Math.PI
export function thetaRangesOverlap(
  r1start: number,
  r1length: number,
  r2start: number,
  r2length: number,
) {
  if (r1length <= 0 || r2length <= 0) {
    return false
  }
  if (r1length + 0.0001 >= twoPi || r2length + 0.0001 >= twoPi) {
    return true
  }

  // put both range starts between 2π and 4π
  r1start = (((r1start % twoPi) + twoPi) % twoPi) + twoPi
  r2start = (((r2start % twoPi) + twoPi) % twoPi) + twoPi

  if (r1start < r2start + r2length && r1start + r1length > r2start) {
    return true
  }

  // move r2 2π to the left and check
  r2start -= twoPi
  if (r1start < r2start + r2length && r1start + r1length > r2start) {
    return true
  }

  // move it 2π to the right and check
  r2start += twoPi + twoPi
  return r1start < r2start + r2length && r1start + r1length > r2start
}

// return which arc range has any part of the circle visible in the viewport
export function viewportVisibleSection(
  viewSides: [number, number, number, number],
  circleCenter: [number, number],
  circleRadius: number,
) {
  let [viewL, viewR, viewT, viewB] = viewSides
  const [cx, cy] = circleCenter

  // transform coordinate system to center of circle
  viewL -= cx
  viewR -= cx
  viewT -= cy
  viewB -= cy

  const centerIsInsideViewport =
    viewL < 0 && viewR > 0 && viewT < 0 && viewB > 0

  if (centerIsInsideViewport) {
    const vertices = [
      [viewL, viewT],
      [viewR, viewT],
      [viewL, viewB],
      [viewR, viewB],
    ]
    let maxRho = -Infinity
    for (let i = 0; i < vertices.length; i += 1) {
      const [x, y] = vertices[i]
      const rho = Math.sqrt(x * x + y * y)
      if (rho > maxRho) {
        maxRho = rho
      }
    }
    return {
      rho: [0, Math.min(circleRadius, maxRho)],
      theta: [0, 2 * Math.PI],
    }
  }
  // const viewportCompletelyContainsCircle =
  //   circleCenter[0] - viewL >= circleRadius &&
  //   viewR - circleCenter[0] >= circleRadius &&
  //   circleCenter[1] - viewT >= circleRadius &&
  //   viewB - circleCenter[1] >= circleRadius

  // if (viewportCompletelyContainsCircle) {
  //   return [0, 2 * Math.PI]
  // }

  // const distToCenterSquared = ([x, y]) => {
  //   const [cx, cy] = circleCenter
  //   const sq = n => n * n
  //   return sq(x - cx) + sq(y - cy)
  // }
  // const circleRadiusSquared = circleRadius * circleRadius

  // const tlInside = distToCenterSquared([viewL, viewT]) <= circleRadiusSquared
  // const trInside = distToCenterSquared([viewR, viewT]) <= circleRadiusSquared
  // const blInside = distToCenterSquared([viewL, viewB]) <= circleRadiusSquared
  // const brInside = distToCenterSquared([viewR, viewB]) <= circleRadiusSquared

  // const noIntersection = !tlInside && !trInside && !blInside && !brInside
  // if (noIntersection) return undefined

  // const circleCompletelyContainsViewport =
  //   tlInside && trInside && blInside && brInside
  // if (circleCompletelyContainsViewport) {
  //   // viewport is in the circle, but the center is not in it, so take max
  //   // and min of thetas to the center
  //   const thetas = [
  //     Math.atan(viewT / viewL),
  //     Math.atan(viewT / viewR),
  //     Math.atan(viewB / viewL),
  //     Math.atan(viewB / viewR),
  //   ]

  //   return [Math.min(...thetas), Math.max(...thetas)]
  // }

  // if we get here, the viewport is partly in, partly out of the circle

  // const viewLIntersects = Math.abs(viewL - circleCenter[0]) <= circleRadius
  // const viewRIntersects = Math.abs(viewR - circleCenter[0]) <= circleRadius
  // const viewTIntersects = Math.abs(viewT - circleCenter[1]) <= circleRadius
  // const viewBIntersects = Math.abs(viewB - circleCenter[1]) <= circleRadius

  // const numIntersectingSides =
  //   Number(viewLIntersects) +
  //   Number(viewRIntersects) +
  //   Number(viewTIntersects) +
  //   Number(viewBIntersects)

  // if (numIntersectingSides === 4) return [0, 2 * Math.PI]
  // if (numIntersectingSides === 3) {
  //   // TODO calculate the thetas of the
  // } else if (numIntersectingSides === 2) {
  //   // TODO calculate the thetas of the 2 intersection points
  // } else if (numIntersectingSides === 1) {
  //   // TODO calculate the thetas of the 1-2 intersection points of the line, and the angle between
  // }

  // make a list of vertices-of-interest that lie inside both shapes to examine
  // to determine the range covered by their intersection

  // transform coordinates to have the circle as the origin and find the intersections
  // of the circle and the view rectangle
  const vertices: [number, number][] = [
    [viewL, viewT],
    [viewR, viewT],
    [viewL, viewB],
    [viewR, viewB],
  ]
  findCircleIntersectionY(viewL, 0, 0, circleRadius, vertices)
  findCircleIntersectionY(viewR, 0, 0, circleRadius, vertices)
  findCircleIntersectionX(viewT, 0, 0, circleRadius, vertices)
  findCircleIntersectionX(viewB, 0, 0, circleRadius, vertices)

  // for each edge, also look at the closest point to center if it is inside the circle
  if (-viewL < circleRadius) {
    vertices.push([viewL, 0])
  }
  if (viewR < circleRadius) {
    vertices.push([viewR, 0])
  }
  if (-viewT < circleRadius) {
    vertices.push([0, viewT])
  }
  if (viewB < circleRadius) {
    vertices.push([0, viewB])
  }

  // const verticesOriginal = vertices.map(([x, y]) => [x + cx, y + cy])

  // now convert them all to polar and take the max and min of rho and theta

  // const viewportCenterTheta = cartesianToTheta(viewR + viewL, viewT + viewB)
  const reflect = viewL >= 0 ? -1 : 1
  // viewportCenterTheta < Math.PI / 2 || viewportCenterTheta > 1.5 * Math.PI
  //   ? -1
  //   : 1
  let rhoMin = Infinity
  let rhoMax = -Infinity
  let thetaMin = Infinity
  let thetaMax = -Infinity
  for (let i = 0; i < vertices.length; i += 1) {
    // ignore vertex if outside the viewport
    const [vx, vy] = vertices[i]
    if (vx >= viewL && vx <= viewR && vy >= viewT && vy <= viewB) {
      const [rho, theta] = cartesianToPolar(vx * reflect, vy * reflect)
      // ignore vertex if outside the circle
      if (rho <= circleRadius + 0.001) {
        // ignore theta if rho is 0
        if (theta < thetaMin && rho > 0.0001) {
          thetaMin = theta
        }
        if (theta > thetaMax && rho > 0.0001) {
          thetaMax = theta
        }
        if (rho < rhoMin) {
          rhoMin = rho
        }
        if (rho > rhoMax) {
          rhoMax = rho
        }
      }
    }
  }

  if (reflect === -1) {
    thetaMin += Math.PI
    thetaMax += Math.PI
  }

  if (thetaMin > 2 * Math.PI && thetaMax > 2 * Math.PI) {
    thetaMin -= 2 * Math.PI
    thetaMax -= 2 * Math.PI
  }

  return {
    rho: [rhoMin, Math.min(circleRadius, rhoMax)],
    theta: [thetaMin, thetaMax],
  }
}
