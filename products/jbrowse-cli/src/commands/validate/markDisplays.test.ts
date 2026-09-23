/**
 * @jest-environment node
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { configManifest } from './configManifest.generated.ts'
import { isRecord, liftToSnapshot } from './liftConfig.ts'
import { MARK_RULES } from './markRules/markProblems.ts'
import { validateConfig } from './validateConfig.ts'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')

function configOf(
  marks: unknown[],
  display: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ref',
          adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
        },
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'scores',
        assemblyNames: ['hg38'],
        adapter: { type: 'BedTabixAdapter', uri: 'scores.bed.gz' },
        displays: [{ type: 'LinearMarkDisplay', marks, ...display }],
      },
    ],
  }
}

const reached = new Set<string>()

function problemsOf(config: unknown) {
  const { problems } = validateConfig(config)
  for (const { rule } of problems) {
    if (rule) {
      reached.add(rule)
    }
  }
  return problems
}

function found(marks: unknown[], display?: Record<string, unknown>) {
  return problemsOf(configOf(marks, display)).map(
    p => `${p.level} ${p.rule} ${p.where}`,
  )
}

const DISPLAY = 'tracks[0].displays[0]'
const COVERAGE = {
  mark: 'bar',
  transform: [{ type: 'coverage' }],
  encoding: { y: 'coverage' },
}
const PILEUP = { mark: 'span', transform: [{ type: 'pileup' }] }

describe('a marks list in a config file', () => {
  it('passes the guide examples', () => {
    expect(
      found([
        { mark: 'bar', encoding: { y: 'score' }, maxBpPerPx: 100 },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 'auto' },
            { type: 'aggregate', ops: [{ op: 'count' }] },
          ],
          encoding: { y: 'count' },
          minBpPerPx: 100,
        },
      ]),
    ).toEqual([])
    expect(found([PILEUP])).toEqual([])
    expect(found([COVERAGE])).toEqual([])
  })

  it('reports a bar or point naming no y once, from the schema requirement', () => {
    expect(
      problemsOf(configOf([{ mark: 'bar' }, { encoding: { x: 'start' } }])),
    ).toEqual(
      [0, 1].map(mark => ({
        level: 'error',
        where: `${DISPLAY}.marks[${mark}].encoding.y`,
        rule: 'mark-without-value',
        message:
          'a bar or a point stands at a value and names no y field to plot, so it draws nothing',
      })),
    )
    expect(found([{ mark: 'point', encoding: { y: '' } }])).toEqual([
      `error mark-without-value ${DISPLAY}.marks[0].encoding.y`,
    ])
    expect(found([{ mark: 'span' }])).toEqual([])
  })

  it('reports the rules of the other marks beside a requirement failure', () => {
    expect(
      found([
        { mark: 'bar' },
        {
          mark: 'bar',
          encoding: { y: 'score' },
          minBpPerPx: 100,
          maxBpPerPx: 20,
        },
      ]),
    ).toEqual([
      `error mark-without-value ${DISPLAY}.marks[0].encoding.y`,
      `error empty-zoom-range ${DISPLAY}.marks[1].minBpPerPx`,
    ])
  })

  it('warns on a channel the mark does not read', () => {
    expect(found([{ mark: 'span', encoding: { y: 'score' } }])).toEqual([
      `warning unread-channel ${DISPLAY}.marks[0].encoding.y`,
    ])
    expect(
      found([{ mark: 'bar', encoding: { y: 'score', shape: 'triangle' } }]),
    ).toEqual([`warning unread-channel ${DISPLAY}.marks[0].encoding.shape`])
    expect(found([{ mark: 'span', size: 8 }])).toEqual([
      `warning unread-size ${DISPLAY}.marks[0].size`,
    ])
  })

  it('tells a valued mark beside a packed span it stands in the first row, unless they never draw together or a facet bands them', () => {
    expect(problemsOf(configOf([COVERAGE, PILEUP]))).toEqual([
      {
        level: 'warning',
        where: `${DISPLAY}.marks[0].encoding.row`,
        rule: 'value-beside-rows',
        message:
          'stands in the first of the rows mark 1 bands the plot into, its axis repeated per row',
      },
    ])
    expect(
      found([
        { ...COVERAGE, minBpPerPx: 20 },
        { ...PILEUP, maxBpPerPx: 20 },
      ]),
    ).toEqual([])
    expect(found([COVERAGE, PILEUP], { facet: 'HP' })).toEqual([])
    expect(found([COVERAGE, PILEUP], { facet: { field: 'HP' } })).toEqual([])
    expect(found([COVERAGE, PILEUP], { facet: { domain: ['1'] } })).toEqual([
      `warning value-beside-rows ${DISPLAY}.marks[0].encoding.row`,
    ])
  })

  it('points two marks packing rows of their own at one shared pileup', () => {
    const filtered = (expr: string) => ({
      mark: 'span',
      transform: [{ type: 'filter', expr }, { type: 'pileup' }],
    })
    expect(found([filtered('jexl:a'), filtered('jexl:b')])).toEqual([
      `warning two-packings ${DISPLAY}.marks[1].transform`,
    ])
    expect(
      found([PILEUP], { facet: 'HP', transform: [{ type: 'pileup' }] }),
    ).toEqual([
      `warning cross-section-packing ${DISPLAY}.transform[0]`,
      `warning two-packings ${DISPLAY}.marks[0].transform`,
    ])
  })

  it('names the fields the steps leave where y reads another', () => {
    expect(
      problemsOf(
        configOf([
          {
            mark: 'bar',
            transform: [{ type: 'bin', step: 1000 }, { type: 'aggregate' }],
            encoding: { y: 'score' },
          },
        ]),
      ),
    ).toEqual([
      {
        level: 'error',
        where: `${DISPLAY}.marks[0].encoding.y`,
        rule: 'unwritten-y',
        message:
          'reads "score", which no step before it writes; they leave refName, start, end',
      },
    ])
    expect(
      found([
        {
          mark: 'bar',
          transform: [
            { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
            { type: 'formula', expr: 'jexl:feature.mean_score*2', as: 'twice' },
          ],
          encoding: { y: 'twice' },
        },
      ]),
    ).toEqual([])
    expect(
      found([{ ...COVERAGE, encoding: { y: 'jexl:feature.coverage' } }]),
    ).toEqual([])
  })

  it('reads a step output by the name the step writes it to', () => {
    const depth = (as: unknown) => [
      {
        mark: 'bar',
        transform: [{ type: 'coverage', as }],
        encoding: { y: 'depth' },
      },
    ]
    expect(found(depth('depth'))).toEqual([])
    expect(found(depth('reads'))).toEqual([
      `error unwritten-y ${DISPLAY}.marks[0].encoding.y`,
    ])
  })

  it('says a pair slot naming another number of fields reads its default', () => {
    expect(
      found([
        {
          mark: 'span',
          transform: [{ type: 'bin', step: 10, as: ['lo'] }],
        },
      ]),
    ).toEqual([`warning step-pair ${DISPLAY}.marks[0].transform[0].as`])
  })

  it('says which slot of a step cannot run', () => {
    expect(
      found([
        {
          mark: 'bar',
          encoding: { y: 'sum' },
          transform: [
            { type: 'filter', expr: 'feature.score > 1' },
            { type: 'bin', step: 0 },
            { type: 'aggregate', ops: [{ op: 'sum', as: 'sum' }] },
          ],
        },
      ]),
    ).toEqual([
      `error step-expression ${DISPLAY}.marks[0].transform[0].expr`,
      `error bin-width ${DISPLAY}.marks[0].transform[1].step`,
      `error op-field ${DISPLAY}.marks[0].transform[2].ops[0].field`,
    ])
  })

  it("checks the display's own steps, at the display's path", () => {
    const bar = { mark: 'bar', encoding: { y: 'score' } }
    expect(
      found([bar], {
        transform: [
          { type: 'filter', expr: "get(feature,'score') > 1" },
          { type: 'bin', step: -5 },
        ],
      }),
    ).toEqual([
      `error step-expression ${DISPLAY}.transform[0].expr`,
      `error bin-width ${DISPLAY}.transform[1].step`,
    ])
    expect(
      found([bar], {
        transform: [
          { type: 'formula', expr: 'jexl:1', as: 'score' },
          {
            type: 'aggregate',
            ops: [{ op: 'sum', field: 'jexl:feature.score' }],
          },
        ],
      }),
    ).toEqual([`error undefined ${DISPLAY}.transform[1].ops[0].field`])
  })

  it("checks a display's own steps when its marks come from displayDefaults", () => {
    const config = configOf([])
    const [track] = config.tracks as Record<string, unknown>[]
    track!.displayDefaults = {
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    }
    track!.displays = [
      {
        type: 'LinearMarkDisplay',
        transform: [{ type: 'filter', expr: "get(feature,'score') > 1" }],
      },
    ]
    expect(
      problemsOf(config).map(p => `${p.level} ${p.rule} ${p.where}`),
    ).toEqual([`error step-expression ${DISPLAY}.transform[0].expr`])
  })

  it("reports an unknown key on one mark beside its siblings' problems", () => {
    const bar = { mark: 'bar', encoding: { y: 'score' } }
    const problems = problemsOf(
      configOf([{ ...bar, colour: 'red' }, PILEUP, PILEUP]),
    )
    expect(problems.map(p => `${p.level} ${p.rule} ${p.where}`)).toEqual([
      `error undefined ${DISPLAY}.marks[0].colour`,
      `warning two-packings ${DISPLAY}.marks[2].transform`,
    ])
    expect(problems[0]!.message).toMatch(/^unknown slot "colour" — Mark takes /)
    expect(problems[1]!.message).toMatch(
      /^packs rows of its own, as mark 1 does/,
    )
  })

  it("reports an unknown key on one display step beside the others' problems", () => {
    expect(
      found([{ mark: 'bar', encoding: { y: 'score' } }], {
        transform: [
          { type: 'filter', expr: 'jexl:1', step: 5 },
          { type: 'bin', step: -5 },
        ],
      }),
    ).toEqual([
      `error undefined ${DISPLAY}.transform[0].step`,
      `error bin-width ${DISPLAY}.transform[1].step`,
    ])
  })

  it('takes a Vega-Lite layer as written, and refuses a key the schema does not declare', () => {
    const messages = (marks: unknown[]) =>
      problemsOf(configOf(marks)).map(p => `${p.where}: ${p.message}`)
    const point = (encoding: Record<string, unknown>) => [
      { mark: 'point', encoding: { y: 'score', ...encoding } },
    ]
    expect(messages(point({ shape: { field: 'strand' } }))).toEqual([])
    expect(messages(point({ glyph: { field: 'strand' } }))).toEqual([
      expect.stringMatching(
        /encoding\.glyph: unknown slot "glyph" — MarkEncoding takes /,
      ),
    ])
    expect(
      messages(point({ color: { field: 'strand', palette: ['red'] } })),
    ).toEqual([
      expect.stringMatching(
        /encoding\.color\.palette: unknown slot "palette" — MarkColor takes value, field, /,
      ),
    ])
  })

  it('reports a mark that is not an object as that alone', () => {
    expect(
      found([null, 'bar', { mark: 'bar', encoding: { y: 'score' } }]),
    ).toEqual([
      `error undefined ${DISPLAY}.marks[0]`,
      `error undefined ${DISPLAY}.marks[1]`,
    ])
  })

  it('points a jexl: field on a step at formula', () => {
    const grouped = (field: string) => [
      {
        mark: 'bar',
        encoding: { y: 'count' },
        transform: [
          { type: 'aggregate', groupby: [field], ops: [{ op: 'count' }] },
        ],
      },
    ]
    expect(found(grouped('INFO.DP'))).toEqual([])
    expect(found(grouped('jexl:feature.INFO.DP[0]'))).toEqual([
      `error step-field-expression ${DISPLAY}.marks[0].transform[0].groupby[0]`,
    ])
  })

  it('reads threshold cuts written as numbers or as strings, and the ends of a ramp', () => {
    const colored = (mark: string, color: Record<string, unknown>) => [
      {
        mark,
        encoding: { ...(mark === 'span' ? {} : { y: 'score' }), color },
      },
    ]
    const cuts = (domain: unknown[]) =>
      found(colored('point', { field: 'pip', scale: 'threshold', domain }))
    const domain = `${DISPLAY}.marks[0].encoding.color.domain`
    expect(cuts([0.1, 0.5])).toEqual([])
    expect(cuts(['0.1', '0.5'])).toEqual([])
    expect(cuts([0.5, 0.1])).toEqual([`warning threshold-cuts ${domain}`])
    expect(cuts(['low', 'high'])).toEqual([`warning threshold-cuts ${domain}`])
    expect(
      found(
        colored('point', {
          field: 'pip',
          scale: 'threshold',
          domain: [0.1, 0.5],
          range: ['red', 'blue'],
        }),
      ),
    ).toEqual([
      `warning threshold-range ${DISPLAY}.marks[0].encoding.color.range`,
    ])
    const ramp = { field: 'score', scale: 'linear', range: ['white', 'red'] }
    const color = `${DISPLAY}.marks[0].encoding.color`
    expect(
      found(colored('bar', { ...ramp, domainMin: 0, domainMax: 10 })),
    ).toEqual([])
    expect(found(colored('bar', { ...ramp, domainMin: 0 }))).toEqual([])
    expect(found(colored('bar', { ...ramp, domain: [0, 10] }))).toEqual([
      `warning ramp-domain ${domain}`,
    ])
    expect(
      found(colored('bar', { ...ramp, domainMin: 10, domainMax: 0 })),
    ).toEqual([`warning ramp-ends ${color}.domainMax`])
    expect(found(colored('span', ramp))).toEqual([
      `warning unpinned-span-ramp ${color}.domainMin`,
    ])
    expect(found(colored('span', { value: 'red' }))).toEqual([])
    expect(found([{ mark: 'span', encoding: { color: 'red' } }])).toEqual([])
  })

  it('reports a zoom range that admits no zoom', () => {
    expect(
      found([
        {
          mark: 'bar',
          encoding: { y: 'score' },
          minBpPerPx: 100,
          maxBpPerPx: 20,
        },
      ]),
    ).toEqual([`error empty-zoom-range ${DISPLAY}.marks[0].minBpPerPx`])
  })

  it('warns on a density source a span or a second mark leaves unread', () => {
    const density = {
      mark: 'bar',
      source: 'density',
      encoding: { y: 'count' },
    }
    expect(found([density, density])).toEqual([
      `warning second-density-mark ${DISPLAY}.marks[1].source`,
    ])
    expect(found([{ mark: 'span', source: 'density' }])).toEqual([
      `warning span-density-source ${DISPLAY}.marks[0].source`,
    ])
  })

  it('leaves a list whose keys or types are wrong to the schema', () => {
    const problems = problemsOf(
      configOf([
        { mark: 'span', encoding: { y: 'score' }, transform: 'pileup' },
      ]),
    )
    expect(problems.map(p => p.where)).toEqual([
      `${DISPLAY}.marks[0].transform`,
    ])
  })

  it('reaches every rule of the list and the schema requirement', () => {
    expect([...reached].sort()).toEqual(
      [...Object.keys(MARK_RULES), 'mark-without-value'].sort(),
    )
  })
})

describe('where a config holds a marks list', () => {
  const marks = [{ mark: 'span', encoding: { y: 'score' } }]
  const base = () => configOf([{ mark: 'bar', encoding: { y: 'score' } }])

  // Why the walk is the whole file and an untyped node carrying `marks` is one
  // of this display's: no other type declares the slot, at any depth.
  it('is the only type in the manifest declaring a marks slot', () => {
    const declares = (slots: unknown): boolean =>
      Array.isArray(slots) &&
      slots.some(
        slot =>
          isRecord(slot) && (slot.name === 'marks' || declares(slot.subSlots)),
      )
    expect(
      Object.values(configManifest).flatMap(group =>
        Object.entries(group).flatMap(([type, entry]) =>
          isRecord(entry) && declares(entry.slots) ? [type] : [],
        ),
      ),
    ).toEqual(['LinearMarkDisplay'])
  })

  it('finds it in displayDefaults', () => {
    const config = base()
    const [track] = config.tracks as Record<string, unknown>[]
    delete track!.displays
    track!.displayDefaults = { marks }
    expect(problemsOf(config).map(p => `${p.rule} ${p.where}`)).toEqual([
      'unread-channel tracks[0].displayDefaults.marks[0].encoding.y',
    ])
  })

  it('finds it on a session track entry, in a view and in a sub-view', () => {
    const entry = { trackId: 'scores', type: 'LinearMarkDisplay', marks }
    const config = {
      ...base(),
      defaultSession: {
        name: 's',
        views: [
          { type: 'LinearGenomeView', assembly: 'hg38', tracks: [entry] },
          {
            type: 'LinearSyntenyView',
            views: [
              { type: 'LinearGenomeView', assembly: 'hg38', tracks: [entry] },
              { type: 'LinearGenomeView', assembly: 'hg38' },
            ],
          },
        ],
      },
    }
    expect(problemsOf(config).map(p => `${p.rule} ${p.where}`)).toEqual([
      'unread-channel defaultSession.views[0].tracks[0].marks[0].encoding.y',
      'unread-channel defaultSession.views[1].views[0].tracks[0].marks[0].encoding.y',
    ])
  })

  it('leaves marks written on a session display node to the schema, which drops them', () => {
    const config = {
      ...base(),
      defaultSession: {
        name: 's',
        views: [
          {
            type: 'LinearGenomeView',
            tracks: [
              {
                type: 'FeatureTrack',
                configuration: 'scores',
                displays: [
                  {
                    type: 'LinearMarkDisplay',
                    configuration: 'scores-LinearMarkDisplay',
                    marks,
                  },
                ],
              },
            ],
          },
        ],
      },
    }
    expect(problemsOf(config).map(p => `${p.rule} ${p.where}`)).toEqual([
      'undefined defaultSession.views[0].tracks[0].displays[0].marks',
    ])
  })
})

describe('a transform step in a config file', () => {
  const stepProblems = (step: Record<string, unknown>) =>
    problemsOf(
      configOf([{ mark: 'bar', encoding: { y: 'score' }, transform: [step] }]),
    ).map(p => `${p.where}: ${p.message}`)
  const STEP = `${DISPLAY}.marks[0].transform[0]`

  it('names its type', () => {
    expect(stepProblems({ step: 1000 })).toEqual([`${STEP}: missing "type"`])
  })

  it('names a type the list has', () => {
    expect(stepProblems({ type: 'fliter', expr: 'jexl:true' })).toEqual([
      `${STEP}.type: expected one of "filter", "formula", "bin", "aggregate", "coverage", "flatten", "pileup", got "fliter"`,
    ])
  })

  it('takes only its own slots, and says a load refuses a key of another step', () => {
    expect(
      stepProblems({ type: 'filter', expr: 'jexl:true', step: 50 }),
    ).toEqual([
      `${STEP}.step: unknown slot "step" — MarkTransform.filter takes type and expr, and JBrowse refuses to load it rather than drop a key it does not declare`,
    ])
  })

  it('reads a slot whose value is itself a choice as that choice', () => {
    expect(stepProblems({ type: 'bin', step: 'wide' })).toEqual([
      `${STEP}.step: expected a number or "auto", got "wide"`,
    ])
    expect(stepProblems({ type: 'bin', step: 'jexl:1000' })).toEqual([
      `${STEP}.step: takes no "jexl:" callback, and "jexl:1000" is one: a slot that takes a callback lists its callback args in the config docs`,
    ])
  })
})

describe('the lift a file takes before the rules read it', () => {
  const slots = configManifest.displays.LinearMarkDisplay!.slots

  it('is what the manifest records of the schema', () => {
    expect(
      liftToSnapshot(
        {
          facet: 'HP',
          marks: [
            {
              encoding: {
                color: 'red',
                shape: 'triangle',
              },
              transform: [{ type: 'coverage', as: 'depth' }],
            },
            {
              encoding: {
                color: { field: 'score', domain: [0, 10] },
              },
            },
          ],
        },
        slots,
      ),
    ).toEqual({
      facet: { field: 'HP' },
      marks: [
        {
          encoding: {
            color: { value: 'red' },
            shape: { value: 'triangle' },
          },
          transform: [{ type: 'coverage', as: 'depth' }],
        },
        { encoding: { color: { field: 'score', domain: ['0', '10'] } } },
      ],
    })
  })
})

function walk(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? walk(path.join(dir, entry.name), name)
      : entry.name === name
        ? [path.join(dir, entry.name)]
        : [],
  )
}

describe('the rule list against the tree', () => {
  const shipped = [
    'test_data/volvox/config_marks.json',
    'test_data/alu_age/config.json',
    'demos/read_marks/config.json',
  ].map(file => path.join(REPO_ROOT, file))

  it.each(shipped)('finds a mark display in %s', file => {
    expect(readFileSync(file, 'utf8')).toContain('LinearMarkDisplay')
  })

  it.each([
    ...new Set([
      ...shipped,
      ...walk(path.join(REPO_ROOT, 'test_data'), 'config.json'),
    ]),
  ])('finds no mark problem in %s', file => {
    const { problems } = validateConfig(JSON.parse(readFileSync(file, 'utf8')))
    expect(
      problems.filter(p => p.rule !== undefined || p.where.includes('marks')),
    ).toEqual([])
  })
})
