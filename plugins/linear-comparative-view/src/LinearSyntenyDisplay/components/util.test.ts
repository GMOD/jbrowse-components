import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { KIND_BASE } from '../../LinearSyntenyRPC/syntenyColors.ts'
import { getCigarOpAtInstance, getTooltip } from './util.ts'

import type { FeatPos } from '../model.ts'

const packed = (len: number, op: number) => (len << 4) | op

// One feature whose CIGAR is M100 D50 M100 I30 M100. Deletions advance the top
// axis (loc1) only, insertions the bottom axis (loc2) only — bpPerPx=1 so both
// indels clear the MIN_INDEL_PX gate and emit as their own quads on top of the
// KIND_BASE block.
function buildIndelGeometry() {
  const refSpan = 100 + 50 + 100 + 100 // M + D + M + M
  const querySpan = 100 + 100 + 30 + 100 // M + M + I + M
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([refSpan]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([querySpan]),
    strands: new Int8Array([1]),
    parsedCigars: [
      [
        packed(100, CIGAR_M),
        packed(50, CIGAR_D),
        packed(100, CIGAR_M),
        packed(30, CIGAR_I),
        packed(100, CIGAR_M),
      ],
    ],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([refSpan]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1000,
  })
}

test('getCigarOpAtInstance resolves D length from loc1 axis, I from loc2', () => {
  const g = buildIndelGeometry()
  const ops = Array.from({ length: g.instanceCount }, (_, i) =>
    getCigarOpAtInstance(g, i),
  )
  expect(ops).toContainEqual({ op: 'D', length: 50 })
  expect(ops).toContainEqual({ op: 'I', length: 30 })
})

test('getCigarOpAtInstance returns undefined for the base block', () => {
  const g = buildIndelGeometry()
  const baseIdx = [...g.kinds].indexOf(KIND_BASE)
  expect(baseIdx).toBeGreaterThanOrEqual(0)
  expect(getCigarOpAtInstance(g, baseIdx)).toBeUndefined()
})

test('getTooltip appends the CIGAR operator line only when given one', () => {
  const feat: FeatPos = {
    id: 'f1',
    strand: 1,
    name: '',
    refName: 'chr1',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
  }
  expect(getTooltip(feat)).not.toContain('CIGAR operator')
  expect(getTooltip(feat, { op: 'D', length: 50 })).toContain(
    'CIGAR operator: 50D',
  )
})
