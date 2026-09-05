import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'
import { when } from 'mobx'
import { renderToString } from 'react-dom/server'

import MultiWayOverlay from './components/MultiWayOverlay.tsx'
import { createDisplay } from './testEnv.ts'

// The export paints the same cells the screen does. What it must not paint is
// the pointer: a figure saved with a ribbon under the cursor came out with
// that group lit in every gutter and outlined in every lane. The screen's
// overlay is where the outline belongs, and it stays there.
test('the SVG export carries no hover; the on-screen overlay does', async () => {
  const display = createDisplay()
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures(
    ['g1', 'g2'].map(
      (name, i) =>
        new SimpleFeature({
          uniqueId: name,
          name,
          refName: 'ctgA',
          start: 100 + 300 * i,
          end: 200 + 300 * i,
          strand: 1,
          mate: {
            assemblyName: 'volvox_random',
            refName: 'ctgB',
            start: 100 + 300 * i,
            end: 200 + 300 * i,
          },
        }),
    ),
  )
  await when(() => display.svgReady, { timeout: 5000 })
  const quiet = renderToString(<svg>{await display.renderSvg()}</svg>)

  const target = display.ribbonGeometry.targets.find(t => t.groupKey === 'g1')!
  display.setHoverTarget({
    label: target.label,
    feature: target.feature,
    groupKey: 'g1',
  })
  expect(display.renderState.hoveredFeatureId).toBeGreaterThan(0)
  expect(display.hoveredGroupOutlines.length).toBeGreaterThan(0)

  const hovered = renderToString(<svg>{await display.renderSvg()}</svg>)
  expect(hovered).not.toContain('multiway-hover-outline')
  expect(hovered).toBe(quiet)

  const { queryAllByTestId } = render(<MultiWayOverlay model={display} />)
  expect(queryAllByTestId('multiway-hover-outline')).toHaveLength(
    display.hoveredGroupOutlines.length,
  )
})
