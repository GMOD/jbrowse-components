import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { KIND_BASE } from '../../LinearSyntenyRPC/syntenyColors.ts'
import { getCigarOpAtInstance, getTooltipLines } from './util.ts'

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
    queryGridAnchors: new Float64Array([0]),
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

test('getTooltipLines appends the CIGAR operator line only when given one', () => {
  const feat: FeatPos = {
    id: 'f1',
    strand: 1,
    name: '',
    refName: 'chr1',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
    attributes: {},
  }
  expect(getTooltipLines(feat)).not.toContain('CIGAR operator: 50D')
  expect(getTooltipLines(feat, { op: 'D', length: 50 })).toContain(
    'CIGAR operator: 50D',
  )
})

// Lines, not one `<br/>`-joined string: a refName and a feature name both come
// out of an alignment file, and the renderer puts these on screen as text nodes
// with no sanitizer on the path.
test('getTooltipLines emits no markup, and drops the lines it has no value for', () => {
  const feat: FeatPos = {
    id: 'f1',
    strand: -1,
    name: '',
    refName: '<img src=x onerror=alert(1)>',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
    attributes: {},
  }
  const lines = getTooltipLines(feat)
  expect(lines.some(l => l.includes('<br'))).toBe(false)
  // the hostile refName rides through verbatim, as text
  expect(lines[0]).toContain('<img src=x onerror=alert(1)>')
  // no identity and no name on this feature, so neither line is emitted
  expect(lines.some(l => l.startsWith('Identity:'))).toBe(false)
  expect(lines.some(l => l.startsWith('Name:'))).toBe(false)
  expect(lines).toContain('Inverted: true')
})

// It listed identity and nothing else, while the fetch carried mapping quality,
// dN/dS and every column an MCScan table declares — all of which the dotplot
// tooltip showed for the same track.
test('getTooltipLines lists every numeric channel the feature carries', () => {
  const feat: FeatPos = {
    id: 'f1',
    strand: 1,
    name: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
    attributes: { identity: 0.987, mappingQual: 60, ka_ks: 1.5 },
  }
  const lines = getTooltipLines(feat)
  expect(lines).toContain('Identity: 0.987')
  expect(lines).toContain('Mapping quality: 60')
  expect(lines).toContain('ka_ks: 1.5')
  // still last, after the channels
  expect(lines.at(-1)).toBe('Name: gene1')
})
