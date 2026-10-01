import {
  ConfigurationSchema,
  liftPlot,
  parsePlot,
  plotChanges,
  plotKeysOf,
  plotOf,
  plotSettingsWritten,
} from '@jbrowse/core/configuration'

import { configSchemaFactory, markListSchema } from './configSchema.ts'
import { markPlotSettingsOf } from './markPlot.ts'
import { markProblems } from './markProblems.ts'

import type { MarkPlot } from './markPlot.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const schema = configSchemaFactory()

function declared(
  plot: MarkPlot = {},
  configSchema: AnyConfigurationSchemaType = schema,
) {
  return configSchema.create({
    type: 'LinearMarkDisplay',
    displayId: 'declared',
    ...plot,
  })
}

function lift(plot: MarkPlot, conf = declared()) {
  return markPlotSettingsOf(liftPlot(conf, plot))
}

describe('the mark display plot', () => {
  it('holds the grammar slots the mark schema declares', () => {
    expect(plotKeysOf(declared())).toEqual(
      expect.arrayContaining(['marks', 'transform', 'facet', 'rows', 'scales']),
    )
  })

  it('refuses a setting the box does not write, naming it', () => {
    const keys = plotKeysOf(declared())
    expect(() => parsePlot('{"marks":[],"height":100}', keys)).toThrow(/height/)
    expect(() => parsePlot('{"marks":[],"height":100}', keys)).toThrow(
      /marks, transform, facet, rows/,
    )
  })

  it('refuses anything that is not one object', () => {
    const keys = plotKeysOf(declared())
    expect(() => parsePlot('[]', keys)).toThrow(/one JSON object/)
    expect(() => parsePlot('nope', keys)).toThrow()
  })

  it('keeps a null so a setting can be cleared', () => {
    expect(parsePlot('{"facet":null}', plotKeysOf(declared()))).toEqual({
      facet: null,
    })
  })
})

describe('liftPlot over a mark display', () => {
  it('expands every shorthand the schema declares', () => {
    const settings = lift({
      marks: [
        { mark: 'point', encoding: { y: 'score', color: { value: 'red' } } },
      ],
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
    const settings = lift({ rows: 'source' }, declared({ facet: 'HP' }))
    expect(settings.facet).toMatchObject({ field: 'HP' })
    expect(markProblems(settings).map(p => p.rule)).toContain(
      'rows-beside-facet',
    )
  })

  it('clears a setting a null names', () => {
    expect(lift({ facet: null }, declared({ facet: 'HP' })).facet).toBe(
      undefined,
    )
  })

  // As Manhattan's does: a null there lands on its point per feature.
  it('resets a cleared marks to the default plot where the schema names one', () => {
    const withDefaultPlot = ConfigurationSchema(
      'DefaultPlotDisplay',
      { marks: markListSchema([{ mark: 'point', encoding: { y: 'score' } }]) },
      {
        baseConfiguration: schema,
        explicitlyTyped: true,
        explicitIdentifier: 'displayId',
      },
    )
    const marks = [{ mark: 'bar', encoding: { y: 'score' } }]
    expect(lift({ marks: null }, declared({ marks })).marks).toEqual([])
    expect(
      lift(
        { marks: null },
        withDefaultPlot.create({ displayId: 'd', marks }),
      ).marks.map(m => m.mark),
    ).toEqual(['point'])
  })
})

describe('markProblems over a lifted plot', () => {
  it('reports a requirement as an error', () => {
    const settings = lift({ marks: [{ mark: 'bar' }] })
    const problems = markProblems(settings)
    expect(problems.map(p => p.rule)).toContain('mark-without-value')
    expect(problems.find(p => p.rule === 'mark-without-value')?.level).toBe(
      'error',
    )
  })

  it('reports an unread channel as a warning, which does not block', () => {
    const settings = lift({
      marks: [{ mark: 'span', encoding: { y: 'score' } }],
    })
    const problems = markProblems(settings)
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
    expect(markProblems(settings).map(p => p.rule)).toContain(
      'empty-zoom-range',
    )
  })
})

describe('plotChanges over a mark display', () => {
  const current = plotOf(
    declared({ marks: [{ mark: 'bar', encoding: { y: 'score' } }] }),
  )

  it('names nothing for a round trip', () => {
    expect(plotChanges(current, current)).toEqual({ sets: [], clears: [] })
  })

  it('separates what is set from what is cleared', () => {
    const next: MarkPlot = { ...current, facet: 'HP', marks: null }
    expect(plotChanges(next, current)).toEqual({
      sets: ['facet'],
      clears: ['marks'],
    })
  })

  it('writes only what moved', () => {
    const next: MarkPlot = { ...current, rows: 'source' }
    expect(plotSettingsWritten(next, current)).toEqual({ rows: 'source' })
  })
})
