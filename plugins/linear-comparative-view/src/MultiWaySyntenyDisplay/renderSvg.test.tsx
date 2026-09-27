import { setConf } from '@jbrowse/core/configuration'
import { SvgThemeProviders } from '@jbrowse/core/svg/SvgThemeProviders'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { withFreshSvgClipIds } from '@jbrowse/core/util/SvgCanvas'
import { bandGroundColor, bandInk } from '@jbrowse/synteny-core'
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

// Each named placement with no gene over it is a box naming the table's gene,
// and the export prints that name in the lane's name row, as the screen does.
test('the export prints the lane names, and none with names off', async () => {
  const display = createDisplay()
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'r1',
      name: 'galF',
      refName: 'ctgA',
      start: 100,
      end: 200,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 200,
        name: 'galF_mate',
      },
    }),
  ])
  await when(() => display.svgReady, { timeout: 5000 })
  display.setShowLegend(false)
  const svg = renderToString(<svg>{await display.renderSvg()}</svg>)
  expect(svg).toContain('>galF<')
  expect(svg).toContain('>galF_mate<')

  display.setShowGeneLabels(false)
  expect(renderToString(<svg>{await display.renderSvg()}</svg>)).not.toContain(
    'galF_mate',
  )
})

// The band keeps a light ground in every theme, so text on it takes the band's
// ink and a band-ground halo where it crosses a ribbon end, whatever the
// export's theme says text and paper are.
test('the export draws lane headers and names in band ink over a band-ground halo, in a dark theme too', async () => {
  const display = createDisplay()
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'r1',
      name: 'galF',
      refName: 'ctgA',
      start: 100,
      end: 200,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 200,
        name: 'galF_mate',
      },
    }),
  ])
  await when(() => display.svgReady, { timeout: 5000 })
  display.setShowLegend(false)
  const node = await display.renderSvg()
  const svg = renderToString(
    <SvgThemeProviders theme={{ palette: { mode: 'dark' } }}>
      <svg>{node}</svg>
    </SvgThemeProviders>,
  )
  const drawn = (text: string) =>
    [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)]
      .filter(([, , body]) => body!.startsWith(text))
      .map(([, attrs]) => ({
        stroke: /stroke="([^"]*)"/.exec(attrs!)?.[1],
        fill: /fill="([^"]*)"/.exec(attrs!)?.[1],
      }))
  for (const text of ['volvox_random', 'galF_mate']) {
    expect(drawn(text)).toEqual([
      { stroke: bandGroundColor(), fill: undefined },
      { stroke: undefined, fill: bandInk().text },
    ])
  }
})
