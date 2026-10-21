import { chooseDisplay, pickDisplayForView } from './displayChoice.ts'

describe('pickDisplayForView', () => {
  // a multi-sample VCF track: two displays declared, matrix first, plus a
  // candidate this view does not draw
  const declaredDisplays = [
    { type: 'MatrixDisplay', displayId: 'vcf_matrix' },
    { type: 'RegularDisplay', displayId: 'vcf_regular' },
  ]
  const candidates = ['MatrixDisplay', 'RegularDisplay', 'ChordDisplay']
  const viewDisplayTypes = ['MatrixDisplay', 'RegularDisplay']

  test('a requested type gets its own config, not the first declared one', () => {
    expect(
      pickDisplayForView({
        candidates,
        declaredDisplays,
        requestedType: 'RegularDisplay',
        viewDisplayTypes,
      }),
    ).toEqual({
      type: 'RegularDisplay',
      conf: { type: 'RegularDisplay', displayId: 'vcf_regular' },
    })
  })

  test('no requested type takes the first candidate the view draws', () => {
    expect(
      pickDisplayForView({
        candidates: ['ChordDisplay', ...candidates],
        declaredDisplays,
        requestedType: undefined,
        viewDisplayTypes,
      }),
    ).toEqual({
      type: 'MatrixDisplay',
      conf: { type: 'MatrixDisplay', displayId: 'vcf_matrix' },
    })
  })

  // A view that inherits another's display types (the circular view takes the
  // linear view's as rings) draws with its own where the track has one, so a
  // config declaring only a linear display still opens as chords.
  test('a view s own display type beats a declared display it only inherits', () => {
    const inherited = {
      candidates: ['RegularDisplay', 'MatrixDisplay', 'ChordDisplay'],
      declaredDisplays: [{ type: 'RegularDisplay', displayId: 'vcf_regular' }],
      requestedType: undefined,
      viewDisplayTypes: [...viewDisplayTypes, 'ChordDisplay'],
    }
    expect(
      pickDisplayForView({
        ...inherited,
        preferredDisplayTypes: new Set(['ChordDisplay']),
      }),
    ).toEqual({ type: 'ChordDisplay', conf: undefined })
    expect(pickDisplayForView(inherited)).toEqual({
      type: 'RegularDisplay',
      conf: { type: 'RegularDisplay', displayId: 'vcf_regular' },
    })
    expect(
      pickDisplayForView({
        ...inherited,
        requestedType: 'RegularDisplay',
        preferredDisplayTypes: new Set(['ChordDisplay']),
      })?.type,
    ).toBe('RegularDisplay')
  })

  test('a candidate the config never declares has no conf to attach', () => {
    expect(
      pickDisplayForView({
        candidates,
        declaredDisplays: [],
        requestedType: undefined,
        viewDisplayTypes,
      }),
    ).toEqual({ type: 'MatrixDisplay', conf: undefined })
  })

  // The refusals below are what a requested type not being taken on faith
  // buys: an unchecked one resolved its dangling `<trackId>-<type>` id back to
  // the track's default display, so a caller that asked for read arcs got the
  // pileup and every layer reported success.
  test('refuses a requested type this view cannot draw', () => {
    expect(
      pickDisplayForView({
        candidates,
        declaredDisplays,
        requestedType: 'ChordDisplay',
        viewDisplayTypes,
      }),
    ).toBeUndefined()
  })

  // a type the track type does not offer, or one its adapter cannot feed,
  // which a config may still declare
  test('refuses a requested type that is no candidate', () => {
    expect(
      pickDisplayForView({
        candidates,
        declaredDisplays: [
          ...declaredDisplays,
          { type: 'GraphDisplay', displayId: 'vcf_graph' },
        ],
        requestedType: 'GraphDisplay',
        viewDisplayTypes: [...viewDisplayTypes, 'GraphDisplay'],
      }),
    ).toBeUndefined()
  })

  test('undefined when the view draws none of the candidates', () => {
    expect(
      pickDisplayForView({
        candidates: ['ChordDisplay'],
        declaredDisplays: [{ type: 'ChordDisplay', displayId: 'vcf_chord' }],
        requestedType: undefined,
        viewDisplayTypes,
      }),
    ).toBeUndefined()
  })
})

describe('chooseDisplay', () => {
  const trackDisplays = [
    { name: 'LinearBasicDisplay', adapterCapabilities: [] },
    { name: 'LinearGraphDisplay', adapterCapabilities: ['getSubgraph'] },
  ]
  const viewDisplays = [
    { name: 'LinearBasicDisplay', viewType: 'LinearGenomeView' },
    { name: 'LinearGraphDisplay', viewType: 'LinearGenomeView' },
  ]
  const choose = (
    adapterCapabilities: string[],
    declared: string[],
    requestedType?: string,
  ) =>
    chooseDisplay({
      trackDisplays,
      adapterCapabilities,
      declaredDisplays: declared.map(type => ({ type })),
      viewType: 'LinearGenomeView',
      viewDisplays,
      requestedType,
    })

  test('the displays a config declares lead the candidates', () => {
    const { candidates, picked } = choose(
      ['getSubgraph'],
      ['LinearGraphDisplay'],
    )
    expect(candidates).toEqual(['LinearGraphDisplay', 'LinearBasicDisplay'])
    expect(picked?.type).toBe('LinearGraphDisplay')
  })

  // the config keeps the entry as settings, but the track cannot open as it
  test('a declared display the adapter cannot feed is no candidate', () => {
    const { candidates, picked } = choose([], ['LinearGraphDisplay'])
    expect(candidates).toEqual(['LinearBasicDisplay'])
    expect(picked?.type).toBe('LinearBasicDisplay')
  })

  test('a requested display the adapter cannot feed opens nothing', () => {
    expect(choose([], [], 'LinearGraphDisplay').picked).toBeUndefined()
  })
})
