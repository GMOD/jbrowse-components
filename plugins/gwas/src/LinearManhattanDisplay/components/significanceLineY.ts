import {
  axisPlotBox,
  clampStrokeInsideAxis,
  scoreToAxisY,
} from '@jbrowse/wiggle-core'

// Its own `.ts` module, apart from the `.tsx` that draws the line, because the
// STATE MODEL reads this and the state model is eagerly evaluated — it is
// reached from the plugin's `exports`, so anything it names statically is in
// every consumer's first download. Importing one function out of a module that
// also exports a React component pulls the component and its MUI tree in with
// it; that is 23 KB gzip on every byo examples-site page, which is what
// `measureEagerBundle.mjs --check` reports.
//
// Screen y for a score on the display's own domain, or undefined when the score
// falls outside it. Outside is a real case rather than a guard: the domain is
// the loaded regions' min/max, so zooming to a quiet stretch of a scan can put
// the threshold above everything on screen, and a line pinned to the top edge
// there would read as "the whole view is significant".
export function significanceLineY(
  score: number | undefined,
  domain: [number, number] | undefined,
  height: number,
) {
  if (score === undefined || !domain) {
    return undefined
  }
  const [min, max] = domain
  if (max === min || score < min || score > max) {
    return undefined
  }
  const box = axisPlotBox(height)
  return clampStrokeInsideAxis(
    scoreToAxisY((score - min) / (max - min), box),
    box.yBottom,
  )
}
