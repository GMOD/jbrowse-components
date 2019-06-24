function findCircleIntersectionX(y, cx, cy, r, resultArray) {
  const d = Math.abs(y - cy)
  if (d > r) return
  if (d === r) {
    resultArray.push([cx, y])
  }
  const solution = Math.sqrt(r * r - d * d)
  resultArray.push([cx - solution, y])
  resultArray.push([cx + solution, y])
}

function findCircleIntersectionY(x, cx, cy, r, resultArray) {
  const d = Math.abs(x - cx)
  if (d > r) return
  if (d === r) {
    resultArray.push([x, cy])
  }
  const solution = Math.sqrt(r * r - d * d)
  resultArray.push([x, cy - solution])
  resultArray.push([x, cy + solution])
}

export function cartesianToPolar(x, y) {
  const rho = Math.sqrt(x * x + y * y)
  if (rho === 0) return [0, 0]
  let theta = (Math.atan(y / x) + 2 * Math.PI) % (2 * Math.PI)
  if (x < 0) {
    if (y <= 0) theta += Math.PI
    else theta -= Math.PI
  }
  return [rho, theta]
}

// return which arc range has any part of the circle visible in the viewport
export function viewportVisibleSlice(viewSides, circleCenter, circleRadius) {
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
      if (rho > maxRho) maxRho = rho
    }
    return { rho: [0, Math.min(circleRadius, maxRho)], theta: [0, 2 * Math.PI] }
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
  const vertices = [
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

  // now convert them all to polar and take the max and min of rho and theta
  let rhoMin = Infinity
  let rhoMax = -Infinity
  let thetaMin = Infinity
  let thetaMax = -Infinity
  for (let i = 0; i < vertices.length; i += 1) {
    // ignore vertex if outside the viewport
    const [vx, vy] = vertices[i]
    if (vx >= viewL && vx <= viewR && vy >= viewT && vy <= viewB) {
      const [rho, theta] = cartesianToPolar(vx, vy)
      // ignore vertex if outside the circle
      if (rho <= circleRadius + 0.001) {
        // ignore theta if rho is 0
        if (theta < thetaMin && rho > 0.0001) thetaMin = theta
        if (theta > thetaMax && rho > 0.0001) thetaMax = theta
        if (rho < rhoMin) rhoMin = rho
        if (rho > rhoMax) rhoMax = rho
      }
    }
  }
  // if the span is close to 180 or over it may be a reverse sweep
  if (thetaMax - thetaMin > Math.PI - 0.0001) {
    const [rho, theta] = cartesianToPolar(
      (viewR + viewL) / 2,
      (viewT + viewB) / 2,
    )
    if (theta < Math.PI / 2 || theta > 1.5 * Math.PI) {
      ;[thetaMin, thetaMax] = [thetaMax, thetaMin + 2 * Math.PI]
    }
  }

  return {
    rho: [rhoMin, Math.min(circleRadius, rhoMax)],
    theta: [thetaMin, thetaMax],
  }
  /*
  cases:
  * viewport completely contains circle - return all

  * circle completely contains viewport
  ** center is inside viewport - return all
  ** center is outside viewport - take max and min of thetas

  * viewport and circle do not intersect - return undefined

  * viewport and circle partially intersect
  */
}
