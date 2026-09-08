import { createTestSession } from '@jbrowse/web/testUtils'
import { observable, when } from 'mobx'

import { KIND_BASE } from '../LinearSyntenyRPC/syntenyColors.ts'
import { packSyntenyFeatureData } from './testUtils.ts'

import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SyntenyRenderingBackend } from './syntenyRenderingBackendTypes.ts'

// **What the drift tables cannot see.** A cross-backend gate proves the two
// backends draw the same picture; nothing in it says how often the bytes behind
// that picture were re-sent. The clicked outline is an upload CELL now, so its
// schedule is a property of the model's getters rather than of a renderer's
// early-out — and the way that goes wrong is silent and expensive: a cell keyed
// on a value read through `renderParams` moves on every pan frame and every
// hover, because `renderParams` carries the two rows' `offsetPx` and `bpPerPx`.
// Each such tick is an O(instanceCount) scan in `packClickedOutlineInstances`
// plus a `hal.uploadBuffer`, for as long as a ribbon stays selected — at the
// 500k-instance whole-genome target that is every pointermove of a drag-pan.
//
// So this file asserts the schedule directly: what moves the outline cell, what
// does not, and that the installer's diff agrees.
jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

// Two features, one BASE instance each, so a second click is a different
// `clickedFeatureId` and therefore a different outline.
const GEOMETRY: SyntenyGeometry = {
  bp1: Float32Array.from([0, 200]),
  bp2: Float32Array.from([100, 300]),
  bp3: Float32Array.from([100, 300]),
  bp4: Float32Array.from([0, 200]),
  base0: 0,
  base1: 0,
  kinds: Uint8Array.from([KIND_BASE, KIND_BASE]),
  instanceFeatureIdx: Uint32Array.from([0, 1]),
  alignmentLengths: Float32Array.from([100, 100]),
  instanceCount: 2,
}

const FEATURES = packSyntenyFeatureData([
  { start: 0, end: 100 },
  { start: 200, end: 300 },
])

// Records which keys the installer's diff pushed, which is the whole question
// here — the frame itself is not.
function recordingBackend() {
  // observable, so the `when`s below track it: the lifecycle autoruns are
  // synchronous at action end, and a plain array would make a `when` that
  // outlives that a hang rather than a failure
  const uploaded = observable.array<number>([])
  const backend: SyntenyRenderingBackend = {
    upload(key) {
      uploaded.push(key)
    },
    release() {},
    renderBlocks() {
      return true
    },
    setErrorHandler() {},
    dispose() {},
  }
  return { uploaded, backend }
}

async function openSelectedRibbon() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'pair',
    name: 'pair',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox',
      targetAssembly: 'volvox2',
    },
  })
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
    tracks: ['pair'],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined)
  const level = view.levels[0]!
  await when(() => level.linearSyntenyDisplays.length > 0)
  const display = level.linearSyntenyDisplays[0]!
  await when(() => display.renderParams !== undefined)

  // the RPC's answer, then a click on the first ribbon
  display.setRpcData(FEATURES, GEOMETRY)
  display.setClickedInstanceIdx(0)
  const { uploaded, backend } = recordingBackend()
  level.startRenderingBackend(backend)
  await when(() => uploaded.includes(display.outlineKey))
  return { view, level, display, uploaded }
}

test('a pan and a hover leave the outline cell alone', async () => {
  const { view, level, display, uploaded } = await openSelectedRibbon()
  const cell = display.outlineCell
  expect(cell?.kind).toBe('outline')
  expect(level.syntenyCells.get(display.outlineKey)).toBe(cell)
  const before = uploaded.length
  const params = display.renderParams

  view.views[0]!.horizontalScroll(120)
  view.views[1]!.horizontalScroll(120)
  display.setHoveredInstanceIdx(1)

  // the pan really did move the frame — otherwise the assertions below are
  // about a view that never changed
  expect(display.renderParams).not.toBe(params)
  expect(display.renderParams!.offsetPx0).not.toBe(params!.offsetPx0)

  expect(display.outlineCell).toBe(cell)
  expect(level.syntenyCells.get(display.outlineKey)).toBe(cell)
  expect(uploaded).toHaveLength(before)
}, 20000)

// The other half, and what keeps the test above from passing vacuously on a
// dead autorun: a click DOES move the cell, and reaches the backend under the
// outline's own key while the track's ribbon buffer stays where it is.
test('a new selection re-uploads the outline and nothing else', async () => {
  const { display, level, uploaded } = await openSelectedRibbon()
  const countOf = (key: number) => uploaded.filter(k => k === key).length
  const cell = display.outlineCell
  const ribbons = level.syntenyCells.get(display.displayKey)
  const outlineUploads = countOf(display.outlineKey)
  const ribbonUploads = countOf(display.displayKey)

  display.setClickedInstanceIdx(1)

  expect(display.outlineCell).not.toBe(cell)
  await when(() => countOf(display.outlineKey) > outlineUploads)
  expect(level.syntenyCells.get(display.displayKey)).toBe(ribbons)
  expect(countOf(display.displayKey)).toBe(ribbonUploads)
}, 20000)
