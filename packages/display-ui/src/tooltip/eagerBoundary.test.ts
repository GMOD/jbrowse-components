import path from 'node:path'

import { moduleReach } from '../importGraph.node.ts'

// `Tooltip.tsx` reaches its positioning library only through
// `lazy(() => import('./TooltipBubble.tsx'))`, and this is the test that keeps
// it that way.
//
// The failure it guards is silent in every other check. Turning that `lazy`
// into a static import changes no markup, no behaviour and no test — the
// tooltip still appears, still positions, still dismisses. What it changes is
// which chunk @floating-ui lands in, and this package's chrome is imported
// eagerly by every display that renders a legend or a corner control, so the
// answer is "the cold shell of every JBrowse product and every embed". That is
// ~266KB of positioning library on the critical path for a box nobody has
// hovered yet.
//
// `@jbrowse/core` learned this the same way and moved `BaseTooltip` out of the
// `ui` barrel onto its own `React.lazy` module — a published ABI break it took
// deliberately, which apollo and react-msaview both had to follow. The two
// tests below are cheaper than making that trade twice.
const isFloatingUi = (spec: string) => spec.startsWith('@floating-ui/')

const index = path.join(__dirname, '../index.ts')

test('nothing on the eager side of the package reaches @floating-ui', () => {
  expect(
    moduleReach(index, { offends: isFloatingUi, followDynamic: false }),
  ).toEqual([])
})

// The negative above passes just as well on a package with no tooltip in it at
// all, so it is worth nothing on its own — a `Tooltip` deleted, renamed, or
// quietly reverted to a `title` attribute reads as a pass. This is the positive
// half: the library IS in the graph, one dynamic edge away.
test('the tooltip bubble reaches @floating-ui behind a dynamic import', () => {
  expect(
    moduleReach(index, { offends: isFloatingUi, followDynamic: true }),
  ).not.toEqual([])
})
