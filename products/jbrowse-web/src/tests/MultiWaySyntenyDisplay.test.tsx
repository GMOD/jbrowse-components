import { BlockSet } from '@jbrowse/core/util/blockTypes'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { renderToString } from 'react-dom/server'

import LaneHeaders from '../../../../plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/components/LaneHeaders.tsx'
import configSnapshot from '../../test_data/multiway_blocks/config.json' with { type: 'json' }
import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { MenuItem } from '@jbrowse/core/ui'
import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'
import type { GenericFilehandle } from 'generic-filehandle2'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

function multiwayGetFile(url: string): GenericFilehandle {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/multiway_blocks/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

utilizeFetchMockForTest(multiwayGetFile)

test('MultiWaySyntenyDisplay fetches and groups a multi-genome blocks track in a plain LGV', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      expect(view.tracks.length).toBe(1)
    },
    { timeout: 30000 },
  )

  const display = view.tracks[0]!.displays[0] as MultiWaySyntenyDisplayModel
  expect(display.type).toBe('MultiWaySyntenyDisplay')

  await waitFor(
    () => {
      expect(display.groups.length).toBe(4)
    },
    { timeout: 30000 },
  )

  expect(display.groups.map(g => g.key)).toEqual(['g1', 'g2', 'g3', 'g4'])
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])
  const g1 = display.groups[0]!
  expect(g1.mates.get('peach')).toHaveLength(1)
  expect(g1.mates.get('cacao')).toHaveLength(1)
  const g2 = display.groups[1]!
  expect(g2.mates.has('cacao')).toBe(false)
  expect(display.features).toHaveLength(6)

  await waitFor(
    () => {
      expect(display.laneGenes?.get('grape')?.length).toBe(2)
    },
    { timeout: 30000 },
  )
  const gene = display
    .laneGenes!.get('grape')!
    .find(g => g.feature.get('name') === 'g1')!
  const exons = gene.feature
    .get('subfeatures')![0]!
    .get('subfeatures')!
    .filter(f => f.get('type') === 'exon')
  expect(exons.map(f => [f.get('start'), f.get('end')])).toEqual([
    [100, 130],
    [170, 200],
  ])

  expect(
    display
      .trackMenuItems()
      .flatMap(item => ('label' in item ? [item.label] : [])),
  ).toContain('Launch stacked synteny view (visible region)')
}, 40000)

// `coarseDynamicBlocks` is empty for the 500ms between a view initializing and
// the coarse autorun's first run, and a restored session reaches that window
// with regions already in the snapshot, so no placement action flushes it.
// `visibleGroups` filtered on it, so over an empty array every group dropped
// and the stack rendered zero lanes while `view.initialized` was already true.
// a3345aa45b built `settledDynamicBlocks` for exactly this class of consumer.
test('MultiWaySyntenyDisplay shows its lanes before the coarse blocks settle', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.groups.length).toBe(4)
      return d!
    },
    { timeout: 30000 },
  )

  await waitFor(
    () => {
      expect(view.coarseDynamicBlocks.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  const settled = display.visibleGroups.length
  expect(settled).toBeGreaterThan(0)

  // Back to the pre-settle state the restore window leaves the view in.
  view.setCoarseDynamicBlocks(new BlockSet([]), view.bpPerPx)
  expect(view.coarseDynamicBlocks).toHaveLength(0)
  expect(view.dynamicBlocks.contentBlocks.length).toBeGreaterThan(0)

  expect(display.visibleGroups).toHaveLength(settled)
}, 40000)

// The lane-alignment chain used to be seeded from a `RowFrame` fitted to the
// widest visible block and spread across the FULL canvas width, while the
// anchor lane's own glyphs go through `view.bpToPx`. Those are different maps
// whenever the widest block does not fill the canvas: at 800px on a 1000bp
// contig the anchor drew [40,760] and the seed spread [0,800], so every lane
// below was aligned against positions up to 40px off and stretched 1.111x.
//
// A `RowFrame` is affine and `bpToPx` is piecewise, so the fix is not a better
// frame — it is seeding from `bpToPx` itself. This pins the two together.
test('MultiWaySyntenyDisplay seeds the lane chain where the anchor lane draws', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.groups.length).toBe(4)
      return d!
    },
    { timeout: 30000 },
  )
  // Zoom out past the contig, so the widest visible block no longer fills the
  // canvas. That is the whole discriminating condition: while one region fills
  // the width exactly, a frame fitted to it and `bpToPx` agree, and the test
  // cannot tell the two seeds apart.
  view.zoomTo(view.bpPerPx * 1.6)
  await waitFor(
    () => {
      expect(display.anchorSpans.size).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  const blocks = view.settledDynamicBlocks as {
    start: number
    end: number
  }[]
  const widest = blocks.reduce((a, b) =>
    b.end - b.start > a.end - a.start ? b : a,
  )
  const widestPx = (widest.end - widest.start) / view.bpPerPx
  expect(widestPx).toBeLessThan(view.width - 20)

  const assembly = display.anchorAssembly!
  for (const group of display.visibleGroups) {
    const refName = assembly.getCanonicalRefName2(group.anchor.refName)
    const a = view.bpToPx({ refName, coord: group.anchor.start })!
    const b = view.bpToPx({ refName, coord: group.anchor.end })!
    const x1 = a.offsetPx - view.offsetPx
    const x2 = b.offsetPx - view.offsetPx
    // The span the anchor lane's own ribbons are drawn at.
    expect(display.anchorSpans.get(group.key)).toEqual(
      x1 < x2 ? [x1, x2] : [x2, x1],
    )
    // ...and the seed is its center, which is what every lane lines up on.
    expect(display.anchorAbsX.get(group.key)!.x - view.offsetPx).toBeCloseTo(
      (x1 + x2) / 2,
      9,
    )
  }

  // And the seed is NOT the widest block spread across the full canvas, which
  // is what it used to be: that map puts `widest.start` at x=0, where bpToPx
  // puts it at the view's own padding.
  const framed = (bp: number) =>
    ((bp - widest.start) / (widest.end - widest.start)) * view.width
  const first = display.visibleGroups[0]!
  expect(display.anchorAbsX.get(first.key)!.x - view.offsetPx).not.toBeCloseTo(
    framed((first.anchor.start + first.anchor.end) / 2),
    0,
  )
}, 40000)

// Lane order was densest-first with no way in but hand-authoring `rowOrder`,
// and it is the one edit a reader wants in front of the picture: a ribbon joins
// ADJACENT lanes only, so a sparse lane mid-stack cuts every chain below it.
// Driven through the menu item's own onClick rather than `setRowOrder`, since
// what the row writes back — the whole order, not the lane that moved — is the
// half that would go unnoticed.
test('MultiWaySyntenyDisplay reorders its lanes from the track menu', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.rowAssemblies).toEqual(['peach', 'cacao'])
      return d!
    },
    { timeout: 30000 },
  )

  const rowNamed = (items: MenuItem[], label: string) => {
    const hit = items.find(i => 'label' in i && i.label === label)
    if (!hit) {
      throw new Error(`no menu row ${label} in ${JSON.stringify(items)}`)
    }
    return hit
  }
  const subMenuOf = (item: MenuItem) =>
    'subMenu' in item ? item.subMenu : ([] as MenuItem[])
  const laneOrder = () => subMenuOf(rowNamed(display.trackMenuItems(), 'Lanes'))
  const click = (item: MenuItem) => {
    ;(item as { onClick: () => void }).onClick()
  }

  click(rowNamed(subMenuOf(rowNamed(laneOrder(), 'cacao')), 'Move up'))
  expect([...display.rowOrder]).toEqual(['cacao', 'peach'])
  expect(display.rowAssemblies).toEqual(['cacao', 'peach'])

  click(rowNamed(laneOrder(), 'Reset lane order'))
  expect([...display.rowOrder]).toEqual([])
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])

  click(rowNamed(subMenuOf(rowNamed(laneOrder(), 'peach')), 'Hide lane'))
  expect(display.rowAssemblies).toEqual(['cacao'])
  expect(display.laneStack.lanes.map(l => l.assemblyName)).toEqual([
    'grape',
    'cacao',
  ])
  click(rowNamed(laneOrder(), 'Show peach'))
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])
}, 40000)

// The ribbons alone carried the hover, and a ribbon joins ADJACENT lanes only:
// `g2` is placed on grape and peach and not on cacao, so hovering it lit one
// ribbon and moved nothing the reader was looking at. `g1` is on all three.
test('MultiWaySyntenyDisplay outlines a hovered group in every lane that places it', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.rowAssemblies).toEqual(['peach', 'cacao'])
      return d!
    },
    { timeout: 30000 },
  )
  const outlines = async () =>
    renderToString(<>{await display.renderSvg()}</>).match(
      /data-testid="multiway-hover-outline"/g,
    )?.length ?? 0

  expect(await outlines()).toBe(0)
  display.setHoveredGroupKey('g1')
  expect(await outlines()).toBe(3)
  display.setHoveredGroupKey('g2')
  expect(await outlines()).toBe(2)
  display.setHoveredGroupKey(undefined)
  expect(await outlines()).toBe(0)

  // ...and the pointer reaches that state on its own. The assertions above set
  // the key by hand, which is how the gene case shipped broken: the anchor
  // lane DRAWS g1 as a gene model, so its box is suppressed, and the hit that
  // replaced it carried no group. `hitTest` is the whole path a hover takes.
  const lane = display.laneStack.lanes[0]!
  // The export is the CAPTION half of the headers: the menu affordance, the
  // grab cursors and the interaction testids are controls, and a saved figure
  // has none of them. They rode along for as long as one component served
  // both, which is also why the affordance had to be placed by a
  // character-count estimate rather than by layout.
  const svg = renderToString(<>{await display.renderSvg()}</>)
  expect(svg).toContain('grape')
  expect(svg).not.toContain('⋮')
  expect(svg).not.toContain('cursor')
  expect(svg).not.toContain('multiway-lane-menu')

  const geneHit = display.hitTest(
    (display.anchorSpans.get('g1')![0] + display.anchorSpans.get('g1')![1]) / 2,
    lane.glyphTop + 1,
  )
  expect(geneHit?.groupKey).toBe('g1')
  display.setHoverTarget(geneHit)
  expect(await outlines()).toBe(3)
}, 40000)

// The menu's Move up/down is two clicks away from the picture; the label is
// on it. jsdom's rects are all zero, so the y the drag reads is clientY
// itself, which the lanes' band extents are stated in
test('MultiWaySyntenyDisplay reorders a lane by dragging its label onto another', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.rowAssemblies).toEqual(['peach', 'cacao'])
      return d!
    },
    { timeout: 30000 },
  )
  const { findByTestId, queryByTestId } = render(
    <LaneHeaders model={display} />,
  )
  const [anchor, peach] = display.laneStack.lanes
  fireEvent.mouseDown(await findByTestId('multiway-lane-label-cacao'), {
    clientY: 1,
  })
  fireEvent.mouseMove(window, { clientY: peach!.bandStart + 1 })
  expect(queryByTestId('multiway-lane-drop')).toBeTruthy()
  fireEvent.mouseUp(window, { clientY: peach!.bandStart + 1 })
  expect(queryByTestId('multiway-lane-drop')).toBeNull()
  expect([...display.rowOrder]).toEqual(['cacao', 'peach'])
  expect(display.rowAssemblies).toEqual(['cacao', 'peach'])

  // a drop on the anchor's band is the top of the mate lanes
  fireEvent.mouseDown(await findByTestId('multiway-lane-label-peach'), {
    clientY: 1,
  })
  fireEvent.mouseUp(window, { clientY: anchor!.bandStart + 1 })
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])

  // the anchor lane is the view's own axis and has nowhere to go
  expect(queryByTestId('multiway-lane-label-grape')!.style.cursor).toBe('')
}, 40000)

// The label's left-click is the drag, so the menu hangs off a right-click and
// off the glyph at the label's end; both raise the same items
test('MultiWaySyntenyDisplay raises a lane menu from its label', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.laneStack.lanes[1]?.frame).toBeDefined()
      return d!
    },
    { timeout: 30000 },
  )
  const { findByTestId, findByText, queryByText } = render(
    <LaneHeaders model={display} />,
  )
  fireEvent.contextMenu(await findByTestId('multiway-lane-label-peach'))
  for (const label of [
    'Move up',
    'Move down',
    'Hide lane',
    'Open peach in a new view',
    'Re-anchor on peach',
  ]) {
    expect(await findByText(label)).toBeTruthy()
  }
  fireEvent.click(await findByText('Hide lane'))
  expect(display.rowAssemblies).toEqual(['cacao'])
  await waitFor(() => {
    expect(queryByText('Hide lane')).toBeNull()
  })

  fireEvent.click(await findByTestId('multiway-lane-menu-grape'))
  expect(await findByText('Open grape in a new view')).toBeTruthy()
  expect(queryByText('Re-anchor on grape')).toBeNull()
  expect(queryByText('Move up')).toBeNull()
}, 40000)

// Re-anchoring is a navigation of the HOSTING view: the anchor lane reads
// off the view's first assembly, so the stack follows on its own and the old
// anchor drops into a mate lane
test('MultiWaySyntenyDisplay re-anchors on a mate lane from its label menu', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.laneStack.lanes[1]?.frame).toBeDefined()
      return d!
    },
    { timeout: 30000 },
  )
  const { findByTestId, findByText } = render(<LaneHeaders model={display} />)
  fireEvent.contextMenu(await findByTestId('multiway-lane-label-peach'))
  fireEvent.click(await findByText('Re-anchor on peach'))

  await waitFor(
    () => {
      expect(view.assemblyNames).toEqual(['peach'])
      expect(display.anchorAssemblyName).toBe('peach')
      expect(display.rowAssemblies.sort()).toEqual(['cacao', 'grape'])
    },
    { timeout: 30000 },
  )
  expect(view.displayedRegions[0]!.refName).toBe('Pp1')
  expect(view.tracks.length).toBe(1)
  await waitFor(
    () => {
      expect(display.laneStack.lanes.map(l => l.assemblyName)[0]).toBe('peach')
      expect(display.groups.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
}, 40000)

test('MultiWaySyntenyDisplay opens a mate lane in a new view with the track along', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.laneStack.lanes[1]?.frame).toBeDefined()
      return d!
    },
    { timeout: 30000 },
  )
  const { findByTestId, findByText } = render(<LaneHeaders model={display} />)
  fireEvent.contextMenu(await findByTestId('multiway-lane-label-peach'))
  fireEvent.click(await findByText('Open peach in a new view'))

  const opened = await waitFor(
    () => {
      expect(session.views.length).toBe(2)
      return session.views[1]
    },
    { timeout: 30000 },
  )
  opened.setWidth(800)
  await waitFor(
    () => {
      expect(opened.initialized).toBe(true)
      expect(opened.assemblyNames).toEqual(['peach'])
      expect(
        opened.tracks.map(
          (t: { configuration: { trackId: string } }) =>
            t.configuration.trackId,
        ),
      ).toEqual(['multiway_blocks'])
    },
    { timeout: 30000 },
  )
  expect(opened.displayedRegions[0]!.refName).toBe('Pp1')
  expect(view.assemblyNames).toEqual(['grape'])
}, 40000)
