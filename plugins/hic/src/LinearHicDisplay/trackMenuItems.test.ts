import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import TuneIcon from '@mui/icons-material/Tune'

import { DEFAULT_HIC_COLOR_SCHEME } from './hicColorConfigSchema.ts'
import { createTestEnvironment } from './testEnv.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the Hi-C track menu, as opposed to what its items do. The
// builder takes a structural interface, so this needs no display instance: the
// stub below is exactly what the model hands it.

function baseSelf() {
  return {
    colorScaleType: 'linear' as const,
    colorFollowsPercentile: true,
    saturationQuantile: 0.95,
    showLegend: false,
    showResolutionControls: false,
    squashToHeight: false,
    colorScheme: DEFAULT_HIC_COLOR_SCHEME,
    hasResolutions: true,
    canStepResolutionFiner: true,
    canStepResolutionCoarser: true,
    availableNormalizations: ['KR', 'VC', 'NONE'] as string[] | undefined,
    activeNormalization: 'KR',
    appliedNormalization: 'KR',
    effectiveResolution: 25000 as number | undefined,
    resolutionBias: 0,
    colorDomain: [0, 40] as [number, number],
    colorDomainMin: undefined as number | undefined,
    colorDomainMax: undefined as number | undefined,
    colorQuantile: 0.95,
    setColorRange: jest.fn(),
    resetColorRange: jest.fn(),
    setLogScale: jest.fn(),
    setColorFollowsPercentile: jest.fn(),
    setShowLegend: jest.fn(),
    setShowResolutionControls: jest.fn(),
    setSquashToHeight: jest.fn(),
    setColorScheme: jest.fn(),
    setActiveNormalization: jest.fn(),
    stepResolution: jest.fn(),
    resetResolutionBias: jest.fn(),
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
  // Every row here only writes a setting, and the menu is an observer, so the
  // ticks move live. They were hand-spelled literals without keepMenuOpen,
  // which dismissed the whole track menu on each toggle.
  it('keeps the menu open for every settings row', () => {
    const items = buildHicTrackMenuItems(makeSelf())
    const rows = [
      ...subMenuOf(items, 'Show...'),
      ...subMenuOf(items, 'Layout'),
      ...subMenuOf(items, 'Color scheme'),
      ...subMenuOf(items, 'Normalization'),
    ].filter(i => i.type === 'radio' || i.type === 'checkbox')

    // 3 visibility and layout checkboxes + 12 schemes + 2 scale toggles + 3
    // normalizations, so the assertion below can't pass by finding no rows
    expect(rows.length).toBe(20)
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
      ['Blueyellowred', false],
      ['Log scale', false],
      ['Emphasize faint contacts (95th percentile)', true],
    ])
  })

  // The resolved normalization drives the tick, not the persisted pick, so a
  // file that lacks the user's choice shows the scheme it really used.
  it('ticks the normalization actually in effect', () => {
    const items = buildHicTrackMenuItems(
      makeSelf({ activeNormalization: 'VC', appliedNormalization: 'VC' }),
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
          appliedNormalization: 'NONE',
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

  // Both lists arrive from an async CoreGetInfo call, so the menu is built at
  // least once without them — an empty submenu would open onto nothing.
  it('drops the resolution and normalization groups until the file describes them', () => {
    const items = buildHicTrackMenuItems(
      makeSelf({
        hasResolutions: false,
        effectiveResolution: undefined,
        availableNormalizations: undefined,
      }),
    )
    expect(items.map(labelOf)).toEqual([
      'Show...',
      'Layout',
      'Color scheme',
      'Color range...',
    ])
    expect(subMenuOf(items, 'Show...').map(labelOf)).not.toContain(
      'Resolution controls',
    )

    expect(
      buildHicTrackMenuItems(makeSelf({ availableNormalizations: [] })).map(
        labelOf,
      ),
    ).not.toContain('Normalization')
  })
})

describe('hic color range row', () => {
  it('captions only the pinned ends', () => {
    const rowLabel = (o: Partial<ReturnType<typeof baseSelf>>) =>
      buildHicTrackMenuItems(makeSelf(o))
        .map(labelOf)
        .find(l => String(l).startsWith('Color range'))
    expect(rowLabel({})).toBe('Color range...')
    expect(rowLabel({ colorDomainMax: 500 })).toBe(
      'Color range (auto – 500)...',
    )
    expect(rowLabel({ colorDomainMin: 2, colorDomainMax: 500 })).toBe(
      'Color range (2 – 500)...',
    )
  })

  it('has its own icon, apart from the Advanced submenu and Normalization', () => {
    const items = buildHicTrackMenuItems(makeSelf())
    const iconOf = (label: string) => {
      const item = items.find(i => String(labelOf(i)).startsWith(label))
      return item && 'icon' in item ? item.icon : undefined
    }
    const icons = [iconOf('Color range'), iconOf('Normalization')]
    expect(new Set([...icons, TuneIcon]).size).toBe(3)
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

  it('Log scale writes color.scale, and unticking leaves no delta', () => {
    const { display } = createDisplay()
    click(display, 'Log scale')
    expect(display.plot).toEqual({ color: { scale: 'log' } })
    expect(display.colorEncoding.scale).toBe('log')
    click(display, 'Log scale')
    expect(display.plot).toEqual({})
    expect(display.colorEncoding.scale).toBe('linear')
  })

  it('the color range writes both ends and the quantile, and resets them', () => {
    const { display } = createDisplay()
    display.setColorRange({ min: 2, max: 500, quantile: 0.99 })
    expect(display.plot).toEqual({
      color: { domainMin: 2, domainMax: 500, domainQuantile: 0.99 },
    })
    expect([display.colorDomainMin, display.colorDomainMax]).toEqual([2, 500])
    display.resetColorRange()
    expect(display.plot).toEqual({})
    expect(display.colorDomainMax).toBeUndefined()
  })

  it('Emphasize faint contacts writes color.domainQuantile', () => {
    const { display } = createDisplay()
    click(display, 'Emphasize faint contacts')
    expect(display.plot).toEqual({ color: { domainQuantile: 1 } })
    click(display, 'Emphasize faint contacts')
    expect(display.plot).toEqual({})
  })
})
