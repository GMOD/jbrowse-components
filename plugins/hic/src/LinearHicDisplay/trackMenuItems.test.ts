import { staysOpenOnClick } from '@jbrowse/core/ui'

import { DEFAULT_HIC_COLOR_SCHEME } from './components/colorRamp.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the Hi-C track menu, as opposed to what its items do. The
// builder takes a structural interface, so this needs no display instance: the
// stub below is exactly what the model hands it.

function baseSelf() {
  return {
    useLogScale: false,
    useColorPercentile: true,
    showLegend: false,
    showLegendDisplayTypeDefault: {
      slot: 'showLegend',
      onValue: false,
      active: false,
      toggle: () => {},
    },
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
    setUseLogScale: jest.fn(),
    setUseColorPercentile: jest.fn(),
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
    return item.subMenu
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
      ...subMenuOf(items, 'Color scheme'),
      ...subMenuOf(items, 'Normalization'),
    ].filter(i => i.type === 'radio' || i.type === 'checkbox')

    // 5 visibility checkboxes + 3 schemes + 3 normalizations, so the assertion
    // below can't pass by finding no rows at all
    expect(rows.length).toBe(11)
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
      ['Juicebox', false],
      ['Fall', false],
      ['Viridis', true],
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
    expect(items.map(labelOf)).toEqual(['Show...', 'Color scheme'])
    expect(subMenuOf(items, 'Show...').map(labelOf)).not.toContain(
      'Show resolution controls',
    )

    expect(
      buildHicTrackMenuItems(makeSelf({ availableNormalizations: [] })).map(
        labelOf,
      ),
    ).not.toContain('Normalization')
  })
})
