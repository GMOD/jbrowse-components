export const twoPi = 2 * Math.PI

// push intersection points where the circle (center cx,cy, radius r) meets a
// horizontal line (orientation='h', y=fixed) or vertical line ('v', x=fixed)
function findCircleIntersection(
  orientation: 'h' | 'v',
  fixed: number,
  cx: number,
  cy: number,
  r: number,
  resultArray: [number, number][],
) {
  const d = Math.abs(fixed - (orientation === 'h' ? cy : cx))
  if (d <= r) {
    const s = Math.sqrt(r * r - d * d)
    const along = orientation === 'h' ? cx : cy
    const pt = (a: number): [number, number] =>
      orientation === 'h' ? [a, fixed] : [fixed, a]
    if (s === 0) {
      resultArray.push(pt(along))
    } else {
      resultArray.push(pt(along - s), pt(along + s))
    }
  }
}

function cartesianToTheta(x: number, y: number) {
  return (Math.atan2(y, x) + twoPi) % twoPi
}

export function cartesianToPolar(x: number, y: number) {
  const rho = Math.hypot(x, y)
  if (rho === 0) {
    return [0, 0] as const
  }
  const theta = cartesianToTheta(x, y)
  return [rho, theta] as const
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

  const vertices: [number, number][] = [
    [viewL, viewT],
    [viewR, viewT],
    [viewL, viewB],
    [viewR, viewB],
  ]

  if (centerIsInsideViewport) {
    const maxRho = Math.max(...vertices.map(([x, y]) => Math.hypot(x, y)))
    return {
      rho: [0, Math.min(circleRadius, maxRho)] as [number, number],
      theta: [0, twoPi] as [number, number],
    }
  }

  // find the intersections of the circle and the view rectangle
  findCircleIntersection('v', viewL, 0, 0, circleRadius, vertices)
  findCircleIntersection('v', viewR, 0, 0, circleRadius, vertices)
  findCircleIntersection('h', viewT, 0, 0, circleRadius, vertices)
  findCircleIntersection('h', viewB, 0, 0, circleRadius, vertices)

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

  // when the viewport is entirely to the right of the circle center (viewL >= 0),
  // rotate 180° (negate both x and y) to shift angles away from the 0/2π
  // wraparound boundary; we undo the shift below by adding π to thetaMin/thetaMax
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

  if (thetaMin > twoPi && thetaMax > twoPi) {
    thetaMin -= twoPi
    thetaMax -= twoPi
  }

  return {
    rho: [rhoMin, Math.min(circleRadius, rhoMax)] as [number, number],
    theta: [thetaMin, thetaMax] as [number, number],
  }
}
