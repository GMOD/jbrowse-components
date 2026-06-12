import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

// In-track stacked group-by (GROUP_BY_PLAN Stage 5): setGroupBy partitions the
// single fetch into N sections rendered in one track. Strand grouping yields a
// forward and a reverse section.
test('group by strand stacks two sections in one track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(5, 100)
  await user.click(
    await screen.findByTestId(
      hts('volvox_alignments_pileup_coverage'),
      ...opts,
    ),
  )
  await screen.findByTestId('pileup-display-done', ...opts)

  // setGroupBy is the Stage 5 action the dialog's "stack" mode calls.
  const display = view.tracks[0]?.displays[0]
  display.setGroupBy({ type: 'strand' })

  // The worker re-partitions; wait until every fetched region carries the two
  // strand groups and the model reports it is grouped into two sections.
  await waitFor(
    () => {
      expect(display.isGrouped).toBe(true)
      expect(display.groupOrder.length).toBe(2)
      expect(display.renderSections.length).toBe(2)
      for (const grouped of display.rpcDataMap.values()) {
        expect(grouped.groups.length).toBe(2)
      }
    },
    { timeout: 30000 },
  )

  const el = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(el), 0.05)

  // The inline section-divider overlay labels each stacked group with its read
  // count (GroupLabelsOverlay).
  await screen.findByText(/Forward strand \(\d+\)/, ...opts)
  await screen.findByText(/Reverse strand \(\d+\)/, ...opts)
}, 60000)

// READ_CONNECTIONS_GROUPED_PLAN Stage 3: paired-end arcs draw per stacked
// section on a shared Y-domain. Grouping by first-of-pair strand keeps both
// mates in the same section (unlike plain strand), so each section's arcs are
// meaningful. Asserts the per-section arc feed is populated, then snapshots.
test('group draws per-section paired-end arcs', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  await view.navToLocString('ctgA:1-50000')
  await user.click(await screen.findByTestId(hts('volvox_sv_cram'), ...opts))
  await screen.findByTestId('pileup-display-done', ...opts)

  const display = view.tracks[0]?.displays[0]
  display.setReadConnections('arc')
  display.setGroupBy({ type: 'firstOfPairStrand' })

  await waitFor(
    () => {
      expect(display.isGrouped).toBe(true)
      expect(display.groupOrder.length).toBe(2)
      // every section carries its own arc feed, and arcs are actually produced.
      let totalArcs = 0
      for (const section of display.sourceSections) {
        for (const data of section.arcsRpcDataMap.values()) {
          totalArcs += data.numArcs
        }
      }
      expect(totalArcs).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  const el = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(el), 0.05)
}, 90000)

// READ_CONNECTIONS_GROUPED_PLAN Stage 4: sashimi junction arcs draw per stacked
// section. Grouping spliced RNA-seq reads by strand keeps each junction in its
// read's strand group, so both sections carry their own sashimi arcs.
test('group draws per-section sashimi arcs', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  await view.navToLocString('ctgA:1-50000')
  await user.click(await screen.findByTestId(hts('spliced'), ...opts))
  await screen.findByTestId('pileup-display-done', ...opts)

  const display = view.tracks[0]?.displays[0]
  display.setShowSashimiArcs(true)
  display.setGroupBy({ type: 'strand' })

  await waitFor(
    () => {
      expect(display.isGrouped).toBe(true)
      expect(display.groupOrder.length).toBe(2)
      // every section yields its own sashimi band, and at least one has arcs.
      expect(display.sashimiSections.length).toBe(2)
      let withArcs = 0
      for (const section of display.sashimiSections) {
        for (const data of section.rpcDataMap.values()) {
          if (data.sashimiX1.length > 0) {
            withArcs++
          }
        }
      }
      expect(withArcs).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  const el = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(el), 0.05)
}, 90000)

test('ungroup restores a single section', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(5, 100)
  await user.click(
    await screen.findByTestId(
      hts('volvox_alignments_pileup_coverage'),
      ...opts,
    ),
  )
  await screen.findByTestId('pileup-display-done', ...opts)

  const display = view.tracks[0]?.displays[0]
  display.setGroupBy({ type: 'strand' })
  await waitFor(() => {
    expect(display.isGrouped).toBe(true)
  }, delay)

  display.setGroupBy(undefined)
  await waitFor(
    () => {
      expect(display.isGrouped).toBe(false)
      expect(display.renderSections.length).toBe(1)
      for (const grouped of display.rpcDataMap.values()) {
        expect(grouped.groups.length).toBe(1)
      }
    },
    { timeout: 30000 },
  )
}, 60000)

test('collapsing a group zeroes its pileup band but keeps coverage', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(5, 100)
  await user.click(
    await screen.findByTestId(
      hts('volvox_alignments_pileup_coverage'),
      ...opts,
    ),
  )
  await screen.findByTestId('pileup-display-done', ...opts)

  const display = view.tracks[0]?.displays[0]
  display.setGroupBy({ type: 'strand' })
  await waitFor(() => {
    expect(display.renderSections.length).toBe(2)
  }, delay)

  const fullHeight = display.sections.contentHeight
  const firstKey = display.groupOrder[0].key
  display.toggleGroupCollapsed(firstKey)

  await waitFor(() => {
    expect(display.isGroupCollapsed(firstKey)).toBe(true)
    // collapsed section's pileup band is 0; coverage band remains.
    const sec = display.sections.sections[0]
    expect(sec.pileupHeight).toBe(0)
    expect(sec.coverageHeight).toBeGreaterThan(0)
    // total stacked height shrinks by the collapsed pileup.
    expect(display.sections.contentHeight).toBeLessThan(fullHeight)
  }, delay)
}, 60000)

test('resizing a group caps its rows independently of the others', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(5, 100)
  await user.click(
    await screen.findByTestId(
      hts('volvox_alignments_pileup_coverage'),
      ...opts,
    ),
  )
  await screen.findByTestId('pileup-display-done', ...opts)

  const display = view.tracks[0]?.displays[0]
  display.setGroupBy({ type: 'strand' })
  await waitFor(() => {
    expect(display.renderSections.length).toBe(2)
  }, delay)

  const firstKey = display.groupOrder[0].key
  const before = display.sections.sections[0].pileupHeight
  const otherBefore = display.sections.sections[1].pileupHeight
  // The first group needs >1 row for a shrink to be observable.
  expect(before).toBeGreaterThan(display.featureHeight + display.featureSpacing)

  // Drag the first section's bottom up by most of its height → fewer rows.
  display.resizeGroupHeight(firstKey, -before)

  await waitFor(() => {
    const sec = display.sections.sections[0]
    expect(sec.pileupHeight).toBeLessThan(before)
    expect(sec.pileupHeight).toBeGreaterThan(0)
    // the other section is untouched by a per-group resize.
    expect(display.sections.sections[1].pileupHeight).toBe(otherBefore)
  }, delay)
}, 60000)
