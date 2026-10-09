import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createMafTestEnvironment } from './testEnv.ts'

function displayWith(color: unknown, annotationAdapter: unknown = null) {
  return createMafTestEnvironment({
    annotationAdapter,
    displayConfig: { color },
  }).createDisplay()
}

describe('the color encoding is the field through its preset', () => {
  test.each([
    [
      'mismatch',
      {
        field: 'mismatch',
        scale: 'categorical',
        domain: ['A', 'C', 'G', 'T', 'N', 'gap', 'match'],
      },
    ],
    [
      'base',
      {
        field: 'base',
        scale: 'categorical',
        domain: ['A', 'C', 'G', 'T', 'N', 'gap'],
      },
    ],
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
      'chromosome',
      {
        field: 'chromosome',
        scale: 'categorical',
        domain: ['0', '1', '2', '3', '4'],
        labels: [
          'Main chromosome',
          '2nd source',
          '3rd source',
          '4th source',
          'Other source',
        ],
      },
    ],
    [
      'codon',
      {
        field: 'codon',
        scale: 'categorical',
        domain: ['nonsyn', 'syn', 'stop'],
        labels: ['Nonsynonymous', 'Synonymous', 'Stop gained'],
      },
    ],
  ])('%s', (field, encoding) => {
    const { display } = displayWith(field)
    expect(display.colorEncoding).toMatchObject(encoding)
  })

  test('a written member wins over the preset', () => {
    const { display } = displayWith({ field: 'identity', domainMin: 0.7 })
    expect(display.colorEncoding).toMatchObject({
      domainMin: 0.7,
      domainMax: 1,
    })
  })
})

describe('the key reads the encoding', () => {
  function chromosomeKey(color: Record<string, unknown>) {
    const { display, view } = displayWith({ field: 'chromosome', ...color })
    view.zoomTo(16)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    return display.colorScales[0]
  }

  test('a written title heads it, and "" draws none', () => {
    expect(chromosomeKey({ title: 'Scaffold' })).toMatchObject({
      title: 'Scaffold',
    })
    expect(chromosomeKey({ title: '' })).toMatchObject({ title: '' })
  })

  test('written labels name the ranks', () => {
    expect(chromosomeKey({ labels: ['Home'] })).toMatchObject({
      entries: [{ label: 'Home' }],
    })
  })

  test('codon labels and order follow the encoding, every change listed', () => {
    const { display, view } = displayWith(
      {
        field: 'codon',
        domain: ['stop', 'nonsyn'],
        labels: ['Stop', 'Changed'],
      },
      {},
    )
    view.zoomTo(0.5)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    expect(display.colorScales[0]).toMatchObject({
      id: 'codon',
      entries: [
        { label: 'Stop' },
        { label: 'Changed' },
        { label: 'Synonymous' },
      ],
    })
  })
})

describe('a Row coloring pick writes through the color object', () => {
  test("a new field drops the old field's members", () => {
    const { display } = displayWith({ field: 'chromosome', range: ['red'] })
    display.setRowRendering('identity')
    expect(getSnapshot(display.configuration.color)).toEqual({
      field: 'identity',
    })
  })

  test('the same field keeps them', () => {
    const { display } = displayWith({ field: 'identity', domainMin: 0.7 })
    display.setRowRendering('identity')
    expect(readConfObject(display.configuration.color, 'domainMin')).toBe(0.7)
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
      domainMin: 0.9,
      domainMax: 0.5,
    })
    expect(display.notices).toHaveLength(1)
    expect(display.notices[0]).toMatch(
      /^color\.domainMax: domainMax is below domainMin/,
    )
    expect(display.plotProblems(display.plot)).toEqual(display.notices)
  })

  test('codon with no frames file says the rows paint the mismatches', () => {
    const { display } = displayWith('codon')
    expect(display.notices).toEqual([
      expect.stringMatching(/^color\.field: codon needs an annotationAdapter/),
    ])
    expect(displayWith('codon', {}).display.notices).toEqual([])
  })

  test('a range on a field painting the theme says it goes unread', () => {
    const { display } = displayWith({ field: 'base', range: ['red'] })
    expect(display.notices).toEqual([
      "color.range: base paints the theme's colors and reads no range",
    ])
    setConf(display, 'color', { field: 'chromosome', range: ['red'] })
    expect(display.notices).toEqual([])
  })
})
