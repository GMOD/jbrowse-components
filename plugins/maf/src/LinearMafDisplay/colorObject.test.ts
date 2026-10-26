import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot, onPatch } from '@jbrowse/mobx-state-tree'

import { createMafTestEnvironment } from './testEnv.ts'

function displayWith(
  color: unknown,
  framesAdapter: unknown = null,
  displayConfig: Record<string, unknown> = {},
) {
  return createMafTestEnvironment({
    framesAdapter,
    displayConfig: {
      ...displayConfig,
      ...(color === undefined ? {} : { encoding: { color } }),
    },
  }).createDisplay()
}

describe('the color encoding is the field through its preset', () => {
  test('unset, the theme fills the rows, and a constant is the string', () => {
    expect(displayWith(undefined).display.colorEncoding).toBeUndefined()
    expect(displayWith({ value: '#ccc' }).display.colorEncoding).toBe('#ccc')
  })

  test.each([
    [
      'identity',
      {
        field: 'identity',
        scale: 'linear',
        domainMin: 0,
        domainMax: 1,
        scheme: 'redgreyblue',
        reverse: false,
      },
    ],
    [
      'refNameRank',
      {
        field: 'refNameRank',
        scale: 'ordinal',
        domain: ['0', '1', '2', '3', '4'],
        names: [
          'Main chromosome',
          '2nd source',
          '3rd source',
          '4th source',
          'Other source',
        ],
      },
    ],
  ])('%s', (field, encoding) => {
    const { display } = displayWith(field)
    expect(display.colorEncoding).toMatchObject(encoding)
  })

  test('a written member wins over the preset', () => {
    const { display } = displayWith({
      field: 'identity',
      scale: { domainMin: 0.7 },
    })
    expect(display.colorEncoding).toMatchObject({
      domainMin: 0.7,
      domainMax: 1,
    })
  })
})

describe('the key reads the encoding', () => {
  function chromosomeKey(color: Record<string, unknown>) {
    const { display, view } = displayWith({ field: 'refNameRank', ...color })
    view.zoomTo(16)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    return display.colorScales[0]
  }

  test('a written legend.title heads it, and "" draws none', () => {
    expect(chromosomeKey({ legend: { title: 'Scaffold' } })).toMatchObject({
      title: 'Scaffold',
    })
    expect(chromosomeKey({ legend: { title: '' } })).toMatchObject({
      title: '',
    })
  })

  test('written scale.names name the ranks', () => {
    expect(chromosomeKey({ scale: { names: ['Home'] } })).toMatchObject({
      entries: [{ label: 'Home' }],
    })
  })
})

describe('a Color by pick writes through encoding.color', () => {
  test("a new field drops the old field's members", () => {
    const { display } = displayWith({
      field: 'refNameRank',
      scale: { range: ['red'] },
    })
    display.colorByField('identity')
    expect(getSnapshot(display.configuration.encoding.color)).toEqual({
      field: 'identity',
    })
  })

  test('the same field keeps them', () => {
    const { display } = displayWith({
      field: 'identity',
      scale: { domainMin: 0.7 },
    })
    display.colorByField('identity')
    expect(
      readConfObject(display.configuration, [
        'encoding',
        'color',
        'scale',
        'domainMin',
      ]),
    ).toBe(0.7)
  })

  test('a pick of what already paints writes nothing', () => {
    const { display } = displayWith({
      field: 'identity',
      scale: { domainMin: 0.7 },
      legend: { title: 'Identity' },
    })
    const patches: unknown[] = []
    const dispose = onPatch(display.configuration, p => patches.push(p))
    display.colorByField('identity')
    dispose()
    expect(patches).toEqual([])
  })
})

describe('notices', () => {
  test('a default track lists none', () => {
    const { display } = displayWith(undefined)
    expect(display.notices).toEqual([])
  })

  test('a problem the shared reader finds reaches the corner and the plot editor alike', () => {
    const { display } = displayWith({
      field: 'identity',
      scale: { domainMin: 0.9, domainMax: 0.5 },
    })
    expect(display.notices).toHaveLength(1)
    expect(display.notices[0]).toMatch(
      /^encoding\.color\.scale\.domainMax: domainMax is below domainMin/,
    )
    expect(display.plotProblems(display.plot)).toEqual(display.notices)
  })

  test('a codon layer with no frames file says it draws nothing', () => {
    const codon = { alignments: { bases: { encoding: { color: 'codon' } } } }
    const { display } = displayWith(undefined, null, codon)
    expect(display.notices).toEqual([
      expect.stringMatching(
        /^alignments\.bases\.encoding\.color\.field: codon needs a framesAdapter/,
      ),
    ])
    expect(displayWith(undefined, {}, codon).display.notices).toEqual([])
  })
})
