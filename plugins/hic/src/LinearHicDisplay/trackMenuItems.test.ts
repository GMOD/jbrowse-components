import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { DEFAULT_HIC_COLOR_SCHEME } from './hicColorConfigSchema.ts'
import { createTestEnvironment } from './testEnv.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { HicColorField } from './hicColorConfigSchema.ts'
import type { LinearHicDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the Hi-C track menu, as opposed to what its items do. The
// builder takes a structural interface, so this needs no display instance: the
// stub below is exactly what the model hands it.

function baseSelf() {
  return {
    colorField: 'observed' as HicColorField,
    paintedColorField: 'observed' as HicColorField,
    hasControl: false,
    colorByField: jest.fn(),
    colorScaleType: 'linear' as const,
    colorDomainQuantile: 0.95,
    clipColorDomainQuantile: 0.95,
    showLegend: false,
    heightMode: 'fixed' as const,
    colorScheme: DEFAULT_HIC_COLOR_SCHEME,
    hasBinSizes: true,
    canStepResolutionFiner: true,
    canStepResolutionCoarser: true,
    availableNormalizations: ['KR', 'VC', 'NONE'] as string[] | undefined,
    activeNormalization: 'KR',
    appliedNormalizations: ['KR'],
    binSize: 25000 as number | undefined,
    resolution: 0,
    setLogScale: jest.fn(),
    setColorDomainQuantile: jest.fn(),
    setShowLegend: jest.fn(),
    setHeightMode: jest.fn(),
    setColorScheme: jest.fn(),
    setNormalization: jest.fn(),
    stepResolution: jest.fn(),
    setResolution: jest.fn(),
  }
}

function makeSelf(overrides: Partial<ReturnType<typeof baseSelf>> = {}) {
  return { ...baseSelf(), ...overrides }
}

function labelOf(item: MenuItem) {
  return 'label' in item ? item.label : undefined
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => labelOf(i) === label)
  if (item && 'subMenu' in item) {
    return resolveSubMenu(item)
  } else {
    throw new Error(
      `"${label}" has no submenu in [${items.map(labelOf).join(', ')}]`,
    )
  }
}

describe('hic track menu shape', () => {
  it('offers observed/control only where the adapter names a control', () => {
    const fields = (hasControl: boolean) =>
      subMenuOf(buildHicTrackMenuItems(makeSelf({ hasControl })), 'Values').map(
        labelOf,
      )
    expect(fields(false)).toEqual(['Observed', 'Observed/expected'])
    expect(fields(true)).toEqual([
      'Observed',
      'Observed/expected',
      'Observed/control',
    ])
  })

  // Every row here only writes a setting, and the menu is an observer, so the
  // ticks move live. They were hand-spelled literals without keepMenuOpen,
  // which dismissed the whole track menu on each toggle.
  it('keeps the menu open for every settings row', () => {
    const items = buildHicTrackMenuItems(makeSelf())
    const rows = [
      ...subMenuOf(items, 'Show'),
      ...subMenuOf(items, 'Layout'),
      ...subMenuOf(items, 'Color scheme'),
      ...subMenuOf(items, 'Normalization'),
    ].filter(i => i.type === 'radio' || i.type === 'checkbox')

    // 2 visibility and layout checkboxes + 12 schemes + 2 scale toggles + 3
    // normalizations, so the assertion below can't pass by finding no rows
    expect(rows.length).toBe(19)
    expect(rows.map(i => [labelOf(i), staysOpenOnClick(i)])).toEqual(
      rows.map(i => [labelOf(i), true]),
    )
  })

  it('offers the schemes from the shared table, ticking the active one', () => {
    const items = buildHicTrackMenuItems(makeSelf({ colorScheme: 'viridis' }))
    expect(
      subMenuOf(items, 'Color scheme').map(i => [
        labelOf(i),
        'checked' in i && i.checked,
      ]),
    ).toEqual([
      ['Viridis', true],
      ['Magma', false],
      ['Inferno', false],
      ['Cividis', false],
      ['Juicebox', false],
      ['Fall', false],
      ['Reds', false],
      ['Blues', false],
      ['Redblue', false],
      ['Purpleorange', false],
      ['Redgreyblue', false],
      ['Redyellowblue', false],
      ['Log scale', false],
      ['Emphasize faint contacts (95th percentile)', true],
    ])
  })

  // The resolved normalization drives the tick, not the persisted pick, so a
  // file that lacks the user's choice shows the scheme it really used.
  it('ticks the normalization actually in effect', () => {
    const items = buildHicTrackMenuItems(
      makeSelf({ activeNormalization: 'VC', appliedNormalizations: ['VC'] }),
    )
    expect(
      subMenuOf(items, 'Normalization')
        .filter(i => 'checked' in i && i.checked)
        .map(labelOf),
    ).toEqual(['VC'])
  })

  // A file can list KR yet carry no KR vector at the current binsize (they are
  // stored per resolution), in which case the parser hands back raw counts. The
  // tick follows the data, and the requested row explains where it went rather
  // than leaving an unexplained tick on NONE.
  it('ticks what the data carries when the requested scheme was unavailable', () => {
    const rows = subMenuOf(
      buildHicTrackMenuItems(
        makeSelf({
          availableNormalizations: ['NONE', 'KR'],
          activeNormalization: 'KR',
          appliedNormalizations: ['NONE'],
        }),
      ),
      'Normalization',
    )
    expect(rows.filter(i => 'checked' in i && i.checked).map(labelOf)).toEqual([
      'NONE',
    ])
    const kr = rows.find(i => labelOf(i) === 'KR')!
    expect('helpText' in kr ? kr.helpText : undefined).toMatch(
      /Not available at the current resolution/,
    )
  })

  // test.hic's chrY has no SCALE vector, so a view across chr22 and chrY
  // holds both: the requested row stays ticked and says which pairs fell back
  it('keeps the requested tick where only some pairs fell back, and says so', () => {
    const rows = subMenuOf(
      buildHicTrackMenuItems(
        makeSelf({
          availableNormalizations: ['NONE', 'SCALE'],
          activeNormalization: 'SCALE',
          appliedNormalizations: ['SCALE', 'NONE'],
        }),
      ),
      'Normalization',
    )
    expect(rows.filter(i => 'checked' in i && i.checked).map(labelOf)).toEqual([
      'SCALE',
    ])
    const scale = rows.find(i => labelOf(i) === 'SCALE')!
    expect('helpText' in scale ? scale.helpText : undefined).toBe(
      'Some chromosome pairs in view have no SCALE at the current resolution in this file and show NONE.',
    )
  })

  // Both lists arrive from an async CoreGetInfo call, so the menu is built at
  // least once without them — an empty submenu would open onto nothing.
  it('drops the resolution and normalization groups until the file describes them', () => {
    const items = buildHicTrackMenuItems(
      makeSelf({
        hasBinSizes: false,
        binSize: undefined,
        availableNormalizations: undefined,
      }),
    )
    expect(items.map(labelOf)).toEqual([
      'Show',
      'Layout',
      'Values',
      'Color scheme',
    ])

    expect(
      buildHicTrackMenuItems(makeSelf({ availableNormalizations: [] })).map(
        labelOf,
      ),
    ).not.toContain('Normalization')
  })
})

describe('hic color rows on a display', () => {
  const { createDisplay } = createTestEnvironment()

  function click(display: LinearHicDisplayModel, prefix: string) {
    const row = subMenuOf(buildHicTrackMenuItems(display), 'Color scheme').find(
      i => String(labelOf(i)).startsWith(prefix),
    )
    if (row && 'onClick' in row) {
      row.onClick()
    } else {
      throw new Error(`no "${prefix}" row`)
    }
  }

  it('Log scale writes encoding.color.scale.type, and unticking leaves no delta', () => {
    const { display } = createDisplay()
    click(display, 'Log scale')
    expect(display.plot).toEqual({
      encoding: { color: { scale: { type: 'symlog' } } },
    })
    expect(display.colorEncoding.scale).toBe('symlog')
    click(display, 'Log scale')
    expect(display.plot).toEqual({})
    expect(display.colorEncoding.scale).toBe('linear')
  })

  // count's preset names juicebox under `linear`, and the toggle writes
  // `symlog`: the ramp must not fall back to the scheme-less default
  it('Log scale keeps the field preset ramp', () => {
    const { display } = createDisplay()
    click(display, 'Log scale')
    expect(display.colorScheme).toBe(DEFAULT_HIC_COLOR_SCHEME)
  })

  it('picking the field preset scheme writes no config delta', () => {
    const { display } = createDisplay()
    display.setColorScheme('viridis')
    expect(display.plot).toEqual({
      encoding: { color: { scale: { scheme: 'viridis' } } },
    })
    display.setColorScheme(DEFAULT_HIC_COLOR_SCHEME)
    expect(display.plot).toEqual({})
  })

  it('Emphasize faint contacts writes encoding.color.scale.domainQuantile', () => {
    const { display } = createDisplay()
    click(display, 'Emphasize faint contacts')
    expect(display.plot).toEqual({
      encoding: { color: { scale: { domainQuantile: 1 } } },
    })
    click(display, 'Emphasize faint contacts')
    expect(display.plot).toEqual({})
  })
})
