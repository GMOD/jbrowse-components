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
