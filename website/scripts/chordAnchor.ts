import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// Where a circular view drew one chord, as a point a click actually lands on.
//
// The same problem graphAnchor.ts solves for a bent graph node, one shape
// further: a chord is a quadratic Bezier, so the centre of its bounding box is
// almost never on it, and the resting chords are painted on a canvas rather
// than kept as DOM, so there is no element to click at all.
//
// TWO THINGS ARE HARD, and only one of them is the geometry.
//
// Naming WHICH chord. A feature id is a parse-order artifact (`vcf-19`) that no
// one can predict from the callset, so this matches on the chord's own label,
// the record's name and both of its loci ("SV_20  chr3:139,976,415 →
// chr13:114,353,245"), which each chord display answers for its features.
//
// Landing ON it. A point computed at the curve's midpoint is on the chord and
// still not necessarily clickable: chords bundle toward the centre of the
// circle, so the deepest point of one is where a dozen others cross it, and the
// click goes to whichever is painted last. So this does not trust the geometry
// -- it walks the curve and asks the view's own pick what is on top there,
// returning the first sampled point where the answer is this chord. A chord
// that is completely buried resolves to nothing and fails the spec by name,
// which is the honest answer: there was no pixel of it to click.
export async function chordPoint(page: Page, anchor: AnnotationAnchor) {
  const point = await page.evaluate((label: string) => {
    interface ChordView {
      id: string
      type: string
      offsetRadians: number
      figureOriginXY: [number, number]
      centerXY: [number, number]
      chordDisplays: {
        shapes: { feature: { id: () => string } }[]
        shapeLabel: (feature: { id: () => string }) => string
        shapePathFor: (feature: { id: () => string }) => string
      }[]
      chordAt: (
        dx: number,
        dy: number,
      ) => { feature: { id: () => string } } | undefined
      circularView?: ChordView
      views?: ChordView[]
    }
    // every circular view on the page, the SV inspector's included
    const circles: ChordView[] = []
    const walk = (v: ChordView) => {
      if (v.type === 'CircularView') {
        circles.push(v)
      }
      if (v.circularView) {
        walk(v.circularView)
      }
      v.views?.forEach(walk)
    }
    ;(
      window as unknown as { JBrowseSession: { views: ChordView[] } }
    ).JBrowseSession.views.forEach(walk)

    // Sampled from the ends inward rather than straight down the middle. Near an
    // endpoint a chord is out by the rim where it is alone; the middle is the
    // bundle. Both ends are tried because one of them can be under the ring's
    // own labels or off the visible arc.
    const ts = [
      0.12, 0.88, 0.2, 0.8, 0.3, 0.7, 0.5, 0.06, 0.94, 0.4, 0.6, 0.25, 0.75,
    ]
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(path)
    document.body.append(svg)
    try {
      for (const view of circles) {
        const box = document
          .querySelector(`[data-testid="${CSS.escape(view.id)}"]`)
          ?.getBoundingClientRect()
        if (!box) {
          continue
        }
        const centreX = box.left + view.figureOriginXY[0] + view.centerXY[0]
        const centreY = box.top + view.figureOriginXY[1] + view.centerXY[1]
        const cos = Math.cos(view.offsetRadians)
        const sin = Math.sin(view.offsetRadians)
        for (const display of view.chordDisplays) {
          for (const { feature } of display.shapes) {
            if (!display.shapeLabel(feature).includes(label)) {
              continue
            }
            path.setAttribute('d', display.shapePathFor(feature))
            const total = path.getTotalLength()
            for (const t of ts) {
              // the outline is in the figure's frame; the screen turns it by
              // the view's rotation about the centre
              const p = path.getPointAtLength(total * t)
              const dx = p.x * cos - p.y * sin
              const dy = p.x * sin + p.y * cos
              if (view.chordAt(dx, dy)?.feature.id() === feature.id()) {
                return { x: centreX + dx, y: centreY + dy }
              }
            }
          }
        }
      }
      return undefined
    } finally {
      svg.remove()
    }
  }, anchor.chord ?? '')
  return point
    ? { x: point.x + (anchor.dx ?? 0), y: point.y + (anchor.dy ?? 0) }
    : undefined
}
