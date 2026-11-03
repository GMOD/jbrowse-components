import { render } from '@testing-library/react'

import SequenceTooltip from './SequenceTooltip.tsx'

import type { MafSource } from '../types.ts'

const sample: MafSource = { label: 'panTro6', name: 'panTro6' }

function tooltipText(props: { base?: string; genomicPos?: number }) {
  render(<SequenceTooltip x={0} y={0} sample={sample} {...props} />)
  return document.body.textContent
}

describe('the sequence widget tooltip', () => {
  it('reads a base in an inserted column as an insertion', () => {
    expect(tooltipText({ base: 'A' })).toContain('Insertion (not in reference)')
  })

  it('does not call a gap in an inserted column an insertion of that sample', () => {
    expect(tooltipText({ base: '-' })).not.toContain('Insertion')
  })

  it('reads a base at a reference position as a plain base', () => {
    const text = tooltipText({ base: 'A', genomicPos: 9 })
    expect(text).toContain('Base: A | Pos: 10')
    expect(text).not.toContain('Insertion')
  })
})
