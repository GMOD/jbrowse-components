// Every function in the LGV model that places the viewport either settles the
// coarse blocks or is one of the continuous paths named below.
//
// The coarse blocks are a 500ms throttle. A jump has nothing to coalesce — the
// viewport left behind is a different place, not an old approximation of the new
// one — so a placer that skips `settleCoarseBlocks` leaves the location box, the
// on-screen feature set and the three per-bp scans behind `settledDynamicBlocks`
// reading somewhere else for up to half a second. `settledDynamicBlocks` covers
// only the case where the coarse set is EMPTY; once any placer has settled, a
// missed one is positively wrong rather than absent.
//
// Source-level because the rule is about the set of placers, and two passes of
// adding the call by hand missed three of them: `fitAllRegions`,
// `horizontallyFlip` and `centerAt`. index.test.ts
// §"a jump settles the coarse blocks" exercises the ones someone remembered to
// list; this is what makes the next one fail.
//
// Scoped to this file, which is where the placement vocabulary lives. A caller
// elsewhere builds a placement out of `setNewView`/`setWindow`/`moveTo`/
// `showRegions`, all of which settle — no production file outside this one pairs
// `zoomTo` with `scrollTo` any more (`Base1DViewModel` is a separate model with
// no coarse blocks).

import { readFileSync } from 'node:fs'
import path from 'node:path'

const model = readFileSync(path.join(__dirname, 'model.ts'), 'utf8')

// The writes. `moveTo(self,` is the free helper, which assigns the window
// directly; `self.moveTo(` is the action wrapping it and settles there.
const WRITES = [
  'self.windowWidthBp =',
  'self.windowStartBp =',
  'self.displayedRegions =',
  'self.scrollTo(',
  'this.scrollTo(',
  'self.scrollToBp(',
  'this.scrollToBp(',
  'self.zoomTo(',
  'this.zoomTo(',
  'moveTo(self,',
  // `setWindow` places through `setWindowFrame` rather than writing the pair
  // itself, so without this line the delegation would quietly drop it — and
  // `flyTo` with it — out of the scan the two tests below run.
  'self.setWindowFrame(',
  'this.setWindowFrame(',
]

// The paths a gesture writes through per animation frame, where settling would
// recompute every coarse consumer per frame — the cost the throttle exists to
// avoid.
const CONTINUOUS = {
  scrollTo: 'the chokepoint every horizontal placement writes through',
  scrollToBp: 'scrollTo in bp space, called by the placers and by zoomTo',
  zoomTo: 'the chokepoint every zoom writes through, spring frames included',
  setWidth: 'a resize, which moves the viewport without placing it',
  horizontalScroll: 'a wheel notch or a drag frame',
  slide: 'spring frames, through scrollTo',
  zoom: 'spring frames, through zoomTo',
  setWindowFrame: 'setWindow per animation frame, for flyTo',
}

function bodyFrom(source: string, open: number) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        return source.slice(open, i + 1)
      }
    }
  }
  throw new Error('unbalanced braces')
}

function withoutComments(body: string) {
  return body.replaceAll(/\/\/[^\n]*/g, '').replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

interface Member {
  name: string
  line: number
  body: string
}

function members() {
  const found: Member[] = []
  // an object-literal action/view/method, or the one block written as function
  // declarations, both at the model's member indentation
  for (const match of model.matchAll(
    /^ {6}(?:async )?(?:function )?(\w+)\(/gm,
  )) {
    const open = model.indexOf('{', match.index + match[0].length)
    found.push({
      name: match[1]!,
      line: model.slice(0, match.index).split('\n').length,
      body: withoutComments(bodyFrom(model, open)),
    })
  }
  return found
}

const placers = members().filter(
  m => !(m.name in CONTINUOUS) && WRITES.some(write => m.body.includes(write)),
)

// A rename that emptied the scan would leave every case below vacuously true,
// which is the one way a source-level check fails open.
test('the scan finds the placers it is about', () => {
  const names = placers.map(p => p.name)
  for (const expected of [
    'moveTo',
    'setNewView',
    'setWindow',
    'setDisplayedRegions',
    'showAllRegions',
    'fitAllRegions',
    'horizontallyFlip',
    'clearView',
    'centerAt',
    // a jump that takes a second is still a jump: the flight settles once, at
    // the end, and the per-frame writes go through `setWindowFrame` above
    'flyTo',
  ]) {
    expect(names).toContain(expected)
  }
})

test.each(Object.entries(CONTINUOUS))(
  '%s writes the viewport without settling — %s',
  name => {
    const found = members().filter(m => m.name === name)
    expect(found).toHaveLength(1)
    expect(found[0]!.body).not.toContain('settleCoarseBlocks')
  },
)

test.each(
  placers.map(p => [`${p.name} (model.ts:${p.line})`, p.body] as const),
)('%s settles the coarse blocks', (where, body) => {
  // as an object so a failure names the placer rather than `false !== true`
  expect({ where, settles: body.includes('settleCoarseBlocks') }).toStrictEqual(
    { where, settles: true },
  )
})
