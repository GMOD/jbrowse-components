import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { withFreshSvgClipIds } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'
import { renderToString } from 'react-dom/server'

import { createDisplay } from './testEnv.ts'

// The export paints the same cells the screen does, less the pointer: a figure
// saved with a ribbon under the cursor came out with that group lit in every
// lane, and one saved after a click carried the selected group's boxes in the
// highlight colour. Both are the chrome's ink, which no export reads.
test('the SVG export carries no hover and no selection; the chrome ink does', async () => {
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
  const exported = async () => {
    const node = await display.renderSvg()
    return withFreshSvgClipIds(() => renderToString(<svg>{node}</svg>))
  }
  const quiet = await exported()
  expect(display.hoverInk).toEqual([])
  expect(display.selectionInk).toEqual([])

  const target = display.ribbonGeometry.targets.find(t => t.groupKey === 'g1')!
  display.setHoverTarget({
    label: target.label,
    feature: target.feature,
    groupKey: 'g1',
  })
  expect(display.renderState.hoveredFeatureId).toBeGreaterThan(0)
  const boxes = display.laneStack.lanes.map(lane => ({
    left: 100,
    top: lane.glyphTop,
    width: 100,
    height: display.laneStack.glyphHeight,
  }))
  expect(display.hoverInk).toEqual(boxes)
  expect(await exported()).toBe(quiet)

  display.setHoverTarget(undefined)
  getSession(display).setSelection(target.feature)
  expect(display.selectionInk).toEqual(boxes)
  expect(await exported()).toBe(quiet)
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
