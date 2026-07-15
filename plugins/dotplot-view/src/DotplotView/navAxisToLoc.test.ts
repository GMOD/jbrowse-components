import { parseLocString } from '@jbrowse/core/util'

import { navAxisToLoc } from './afterAttach.ts'

import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

// fake assemblyManager: canonical refName is identity, only bare contig names
// are valid (so "ctgA:5000-15000" parses as a location, not an ambiguous
// refName)
const validRefNames = new Set(['ctgA', 'ctgZ'])
const assemblyManager = {
  get: () => ({ getCanonicalRefName: (r: string) => r }),
  isValidRefName: (r: string) => validRefNames.has(r),
} as any

function fakeView(region: {
  refName: string
  start: number
  end: number
  reversed?: boolean
}) {
  const moveTo = jest.fn()
  const view = {
    displayedRegions: [region],
    moveTo,
  } as unknown as Base1DViewModel
  return { view, moveTo }
}

test('navigates a forward region to the right bp offsets', () => {
  const { view, moveTo } = fakeView({ refName: 'ctgA', start: 0, end: 50000 })
  navAxisToLoc(view, 'ctgA:5000-15000', 'volvox', assemblyManager)
  const { start, end } = parseLocString('ctgA:5000-15000', r =>
    validRefNames.has(r),
  )
  expect(moveTo).toHaveBeenCalledWith(
    { refName: 'ctgA', index: 0, offset: start },
    { refName: 'ctgA', index: 0, offset: end },
  )
})

test('reversed region flips offsets and keeps them ordered', () => {
  const { view, moveTo } = fakeView({
    refName: 'ctgA',
    start: 0,
    end: 50000,
    reversed: true,
  })
  navAxisToLoc(view, 'ctgA:5000-15000', 'volvox', assemblyManager)
  const { start, end } = parseLocString('ctgA:5000-15000', r =>
    validRefNames.has(r),
  )
  // reversed => offset = end - coord; lo/hi reordered ascending
  expect(moveTo).toHaveBeenCalledWith(
    { refName: 'ctgA', index: 0, offset: 50000 - end! },
    { refName: 'ctgA', index: 0, offset: 50000 - start! },
  )
})

test('does nothing when the refName is not displayed on the axis', () => {
  const { view, moveTo } = fakeView({ refName: 'ctgA', start: 0, end: 50000 })
  navAxisToLoc(view, 'ctgZ:5000-15000', 'volvox', assemblyManager)
  expect(moveTo).not.toHaveBeenCalled()
})
