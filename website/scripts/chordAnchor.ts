import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// Where a circular view drew one chord, as a point a click actually lands on.
//
// The same problem graphAnchor.ts solves for a bent graph node, one shape
// further: a chord is a quadratic Bezier, so the centre of its bounding box is
// almost never on it. `elementHandle.click()` targets exactly that centre, which
// is how a chord came to be described as having "no reliable on-screen anchor"
// (scripts/specs/sv.ts) and why every figure of the chr3-chr13 translocation
// anchors to the grid row instead.
//
// TWO THINGS ARE HARD, and only one of them is the geometry.
//
// Naming WHICH chord. The DOM id is `chord-<feature id>`, and a feature id is a
// parse-order artifact (`vcf-19`) that no one can predict from the callset --
// the figure that needed it confirmed the number by walking the React fiber tree
// from the path to its `feature` prop. So this matches on the chord's own
// `<title>`, which `chordLabel` already writes and which is the record's name
// and both of its loci ("SV_20  chr3:139,976,415 → chr13:114,353,245"). That is
// the string a spec should be naming anyway, and it costs the product nothing:
// the title is already there, for readers.
//
// Landing ON it. A point computed at the curve's midpoint is on the chord and
// still not necessarily clickable: chords bundle toward the centre of the
// circle, so the deepest point of one is where a dozen others cross it, and the
// click goes to whichever is painted last. So this does not trust the geometry
// -- it walks the curve and hit-tests, returning the first sampled point where
// the browser agrees the chord is what is on top. A chord that is completely
// buried resolves to nothing and fails the spec by name, which is the honest
// answer: there was no pixel of it to click.
export async function chordPoint(page: Page, anchor: AnnotationAnchor) {
  const point = await page.evaluate((label: string) => {
    const paths = [
      ...document.querySelectorAll<SVGPathElement>(
        'path[data-testid^="chord-"]',
      ),
    ]
    const match = paths.find(p =>
      (p.querySelector('title')?.textContent ?? '').includes(label),
    )
    if (!match) {
      return undefined
    }
    const ctm = match.getScreenCTM()
    const total = match.getTotalLength()
    if (!ctm || !total) {
      return undefined
    }
    // Sampled from the ends inward rather than straight down the middle. Near an
    // endpoint a chord is out by the rim where it is alone; the middle is the
    // bundle. Both ends are tried because one of them can be under the ring's
    // own labels or off the visible arc.
    const ts = [
      0.12, 0.88, 0.2, 0.8, 0.3, 0.7, 0.5, 0.06, 0.94, 0.4, 0.6, 0.25, 0.75,
    ]
    for (const t of ts) {
      const p = match.getPointAtLength(total * t)
      const x = p.x * ctm.a + p.y * ctm.c + ctm.e
      const y = p.x * ctm.b + p.y * ctm.d + ctm.f
      // elementFromPoint is the whole point of this loop: it answers with what a
      // click at (x,y) would actually reach, overlapping chords and any overlay
      // included.
      if (document.elementFromPoint(x, y) === match) {
        return { x, y }
      }
    }
    return undefined
  }, anchor.chord ?? '')
  return point
    ? { x: point.x + (anchor.dx ?? 0), y: point.y + (anchor.dy ?? 0) }
    : undefined
}
