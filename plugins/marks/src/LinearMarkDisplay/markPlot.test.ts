import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory } from './configSchema.ts'
import {
  liftMarkPlot,
  markPlotChanges,
  markPlotOf,
  markPlotProblems,
  markPlotSettingsWritten,
  parseMarkPlot,
  summarizeMarkPlot,
} from './markPlot.ts'

import type { MarkPlot } from './markPlot.ts'

const schema = configSchemaFactory()

function lift(plot: MarkPlot, current: MarkPlot = {}) {
  return liftMarkPlot(schema, plot, current)
}

// markPlotOf reads a snapshot, never a live node: re-creating from a node that
// is already in a tree is what MST refuses.
function declared(plot: MarkPlot) {
  return markPlotOf(
    getSnapshot<Record<string, unknown>>(
      schema.create({
        type: 'LinearMarkDisplay',
        displayId: 'declared',
        ...plot,
      }),
    ),
  )
}

describe('parseMarkPlot', () => {
  it('refuses a setting the box does not write, naming it', () => {
    expect(() => parseMarkPlot('{"marks":[],"height":100}')).toThrow(/height/)
    expect(() => parseMarkPlot('{"marks":[],"height":100}')).toThrow(
      /marks, transform, facet, rows/,
    )
  })

  it('refuses anything that is not one object', () => {
    expect(() => parseMarkPlot('[]')).toThrow(/one JSON object/)
    expect(() => parseMarkPlot('nope')).toThrow()
  })

  it('keeps a null so a setting can be cleared', () => {
    expect(parseMarkPlot('{"facet":null}')).toEqual({ facet: null })
  })
})

describe('liftMarkPlot', () => {
  it('expands every shorthand the schema declares', () => {
    const settings = lift({
      marks: [{ mark: 'point', encoding: { y: 'score', color: 'red' } }],
      facet: 'HP',
      rows: 'source',
    })
    expect(settings.facet).toMatchObject({ field: 'HP' })
    expect(settings.rows).toMatchObject({ field: 'source' })
    expect(settings.marks[0]!.encoding!.color).toMatchObject({ value: 'red' })
  })

  it('refuses a mark type with checkMarks message, not the enumeration', () => {
    expect(() => lift({ marks: [{ mark: 'wiggle' }] })).toThrow(
      /a mark is one of/,
    )
  })

  it('refuses a stray key inside a closed schema', () => {
    expect(() => lift({ marks: [{ encoding: { wye: 'score' } }] })).toThrow()
  })

  // rows inherits `closed` from rowArrangementConfigSchema rather than
  // declaring it, so a misspelled member is refused here as it is in a file.
  // Nothing in the bag swallows a key.
  it('refuses a rows member the schema does not declare rather than swallowing it', () => {
    expect(() => lift({ rows: { field: 'source', sortt: ['a'] } })).toThrow(
      /sortt/,
    )
  })

  it('merges over what is declared, so a cross-slot rule still fires', () => {
    const current = declared({ facet: 'HP' })
    const settings = lift({ rows: 'source' }, current)
    expect(settings.facet).toMatchObject({ field: 'HP' })
    expect(markPlotProblems(settings).map(p => p.rule)).toContain(
      'rows-beside-facet',
    )
  })

  it('clears a setting a null names', () => {
    const current = declared({ facet: 'HP' })
    expect(lift({ facet: null }, current).facet).toBeUndefined()
  })
})

describe('markPlotProblems', () => {
  it('reports a requirement as an error', () => {
    const settings = lift({ marks: [{ mark: 'bar' }] })
    const problems = markPlotProblems(settings)
    expect(problems.map(p => p.rule)).toContain('mark-without-value')
    expect(problems.find(p => p.rule === 'mark-without-value')?.level).toBe(
      'error',
    )
  })

  it('reports an unread channel as a warning, which does not block', () => {
    const settings = lift({
      marks: [{ mark: 'span', encoding: { y: 'score' } }],
    })
    const problems = markPlotProblems(settings)
    expect(problems.map(p => p.rule)).toContain('unread-channel')
    expect(problems.every(p => p.level === 'warning')).toBe(true)
  })

  it('reports a zoom range that never draws', () => {
    const settings = lift({
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score' },
          minBpPerPx: 100,
          maxBpPerPx: 10,
        },
      ],
    })
    expect(markPlotProblems(settings).map(p => p.rule)).toContain(
      'empty-zoom-range',
    )
  })
})

describe('markPlotChanges', () => {
  const current = declared({
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
  })

  it('names nothing for a round trip', () => {
    expect(markPlotChanges(current, current)).toEqual({ sets: [], clears: [] })
    expect(summarizeMarkPlot(current, current, [])).toBe('No changes')
  })

  it('separates what is set from what is cleared', () => {
    const next: MarkPlot = { ...current, facet: 'HP', marks: null }
    expect(markPlotChanges(next, current)).toEqual({
      sets: ['facet'],
      clears: ['marks'],
    })
  })

  it('writes only what moved', () => {
    const next: MarkPlot = { ...current, rows: 'source' }
    expect(markPlotSettingsWritten(next, current)).toEqual({ rows: 'source' })
  })
})

describe('summarizeMarkPlot', () => {
  it('counts the problems the plot still has beside what it writes', () => {
    const problems = markPlotProblems(lift({ marks: [{ mark: 'bar' }] }))
    expect(summarizeMarkPlot({ rows: 'a' }, {}, problems)).toBe(
      'Sets rows. 1 problem',
    )
  })
})
