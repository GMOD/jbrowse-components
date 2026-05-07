function findCircleIntersectionX(
  y: number,
  cx: number,
  cy: number,
  r: number,
  resultArray: [number, number][],
) {
  const d = Math.abs(y - cy)
  if (d <= r) {
    if (d === r) {
      resultArray.push([cx, y])
    } else {
      const solution = Math.sqrt(r * r - d * d)
      resultArray.push([cx - solution, y], [cx + solution, y])
    }
  }
}

function findCircleIntersectionY(
  x: number,
  cx: number,
  cy: number,
  r: number,
  resultArray: [number, number][],
) {
  const d = Math.abs(x - cx)
  if (d <= r) {
    if (d === r) {
      resultArray.push([x, cy])
    } else {
      const solution = Math.sqrt(r * r - d * d)
      resultArray.push([x, cy - solution], [x, cy + solution])
    }
  }
}

function cartesianToTheta(x: number, y: number) {
  return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI)
}

export function cartesianToPolar(x: number, y: number) {
  const rho = Math.sqrt(x * x + y * y)
  if (rho === 0) {
    return [0, 0] as const
  }
  const theta = cartesianToTheta(x, y)
  return [rho, theta] as const
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
    ] as const
    let maxRho = Number.NEGATIVE_INFINITY
    for (const [x, y] of vertices) {
      const rho = Math.sqrt(x * x + y * y)
      if (rho > maxRho) {
        maxRho = rho
      }
    }
    return {
      rho: [0, Math.min(circleRadius, maxRho)] as [number, number],
      theta: [0, 2 * Math.PI] as [number, number],
    }
  }

  // find the intersections of the circle and the view rectangle
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

  const reflect = viewL >= 0 ? -1 : 1
  let rhoMin = Number.POSITIVE_INFINITY
  let rhoMax = Number.NEGATIVE_INFINITY
  let thetaMin = Number.POSITIVE_INFINITY
  let thetaMax = Number.NEGATIVE_INFINITY
  for (const [vx, vy] of vertices) {
    // ignore vertex if outside the viewport
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
    rho: [rhoMin, Math.min(circleRadius, rhoMax)] as [number, number],
    theta: [thetaMin, thetaMax] as [number, number],
  }
}
