import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { resetSvgClipIds } from '@jbrowse/core/util/SvgCanvas'
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
  // each render is its own document, as `wrapSvgExport` makes it in production
  // — the clip ids the mark path's per-block clips mint are document-global, so
  // without this the second export differs from the first by numbering alone
  resetSvgClipIds()
  const quiet = renderToString(<svg>{await display.renderSvg()}</svg>)

  const target = display.ribbonGeometry.targets.find(t => t.groupKey === 'g1')!
  display.setHoverTarget({
    label: target.label,
    feature: target.feature,
    groupKey: 'g1',
  })
  expect(display.renderState.hoveredFeatureId).toBeGreaterThan(0)
  expect(display.hoveredGroupOutlines.length).toBeGreaterThan(0)

  resetSvgClipIds()
  const hovered = renderToString(<svg>{await display.renderSvg()}</svg>)
  expect(hovered).not.toContain('multiway-hover-outline')
  expect(hovered).toBe(quiet)

  const { queryAllByTestId } = render(<MultiWayOverlay model={display} />)
  expect(queryAllByTestId('multiway-hover-outline')).toHaveLength(
    display.hoveredGroupOutlines.length,
  )
})

// A figure of the stack draws no labels at all, so what the exported picture
// says about its colors is the key or nothing.
test('the export carries the color key where the colors key something', async () => {
  const display = createDisplay()
  setConf(display, 'color', "jexl:randomColor(get(feature,'name'))")
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures(
    ['galF', 'wzzB'].map(
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

  const svg = renderToString(<svg>{await display.renderSvg()}</svg>)
  expect(svg).toContain('color-legend')
  expect(svg).toContain('galF')
  expect(svg).toContain('wzzB')

  display.setShowLegend(false)
  expect(renderToString(<svg>{await display.renderSvg()}</svg>)).not.toContain(
    'color-legend',
  )
})
