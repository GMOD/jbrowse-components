// @ts-nocheck
import { shuffle } from '../array.ts'
import lcg from '../lcg.ts'

export default function (circles) {
  return packEncloseRandom(circles, lcg())
}

export function packEncloseRandom(circles, random) {
  let i = 0
  const n = (circles = shuffle(Array.from(circles), random)).length
  let B = []
  let p
  let e

  while (i < n) {
    p = circles[i]
    if (e && enclosesWeak(e, p)) {
      ++i
    } else {
      ;((e = encloseBasis((B = extendBasis(B, p)))), (i = 0))
    }
  }

  return e
}

function extendBasis(B, p) {
  let i
  let j

  if (enclosesWeakAll(p, B)) {
    return [p]
  }

  // If we get here then B must have at least one element.
  for (i = 0; i < B.length; ++i) {
    if (enclosesNot(p, B[i]) && enclosesWeakAll(encloseBasis2(B[i], p), B)) {
      return [B[i], p]
    }
  }

  // If we get here then B must have at least two elements.
  for (i = 0; i < B.length - 1; ++i) {
    for (j = i + 1; j < B.length; ++j) {
      if (
        enclosesNot(encloseBasis2(B[i], B[j]), p) &&
        enclosesNot(encloseBasis2(B[i], p), B[j]) &&
        enclosesNot(encloseBasis2(B[j], p), B[i]) &&
        enclosesWeakAll(encloseBasis3(B[i], B[j], p), B)
      ) {
        return [B[i], B[j], p]
      }
    }
  }

  // If we get here then something is very wrong.
  throw new Error()
}

function enclosesNot(a, b) {
  const dr = a.r - b.r
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dr < 0 || dr * dr < dx * dx + dy * dy
}

function enclosesWeak(a, b) {
  const dr = a.r - b.r + Math.max(a.r, b.r, 1) * 1e-9
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dr > 0 && dr * dr > dx * dx + dy * dy
}

function enclosesWeakAll(a, B) {
  for (let i = 0; i < B.length; ++i) {
    if (!enclosesWeak(a, B[i])) {
      return false
    }
  }
  return true
}

function encloseBasis(B) {
  switch (B.length) {
    case 1:
      return encloseBasis1(B[0])
    case 2:
      return encloseBasis2(B[0], B[1])
    case 3:
      return encloseBasis3(B[0], B[1], B[2])
  }
}

function encloseBasis1(a) {
  return {
    x: a.x,
    y: a.y,
    r: a.r,
  }
}

function encloseBasis2(a, b) {
  const x1 = a.x
  const y1 = a.y
  const r1 = a.r
  const x2 = b.x
  const y2 = b.y
  const r2 = b.r
  const x21 = x2 - x1
  const y21 = y2 - y1
  const r21 = r2 - r1
  const l = Math.sqrt(x21 * x21 + y21 * y21)
  return {
    x: (x1 + x2 + (x21 / l) * r21) / 2,
    y: (y1 + y2 + (y21 / l) * r21) / 2,
    r: (l + r1 + r2) / 2,
  }
}

function encloseBasis3(a, b, c) {
  const x1 = a.x
  const y1 = a.y
  const r1 = a.r
  const x2 = b.x
  const y2 = b.y
  const r2 = b.r
  const x3 = c.x
  const y3 = c.y
  const r3 = c.r
  const a2 = x1 - x2
  const a3 = x1 - x3
  const b2 = y1 - y2
  const b3 = y1 - y3
  const c2 = r2 - r1
  const c3 = r3 - r1
  const d1 = x1 * x1 + y1 * y1 - r1 * r1
  const d2 = d1 - x2 * x2 - y2 * y2 + r2 * r2
  const d3 = d1 - x3 * x3 - y3 * y3 + r3 * r3
  const ab = a3 * b2 - a2 * b3
  const xa = (b2 * d3 - b3 * d2) / (ab * 2) - x1
  const xb = (b3 * c2 - b2 * c3) / ab
  const ya = (a3 * d2 - a2 * d3) / (ab * 2) - y1
  const yb = (a2 * c3 - a3 * c2) / ab
  const A = xb * xb + yb * yb - 1
  const B = 2 * (r1 + xa * xb + ya * yb)
  const C = xa * xa + ya * ya - r1 * r1
  const r = -(Math.abs(A) > 1e-6
    ? (B + Math.sqrt(B * B - 4 * A * C)) / (2 * A)
    : C / B)
  return {
    x: x1 + xa + xb * r,
    y: y1 + ya + yb * r,
    r: r,
  }
}
