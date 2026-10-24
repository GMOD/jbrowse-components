import { readConfObject, setConf } from '@jbrowse/core/configuration'

import {
  DEFAULT_QUALITY_FADE,
  OPAQUE_MISMATCHES,
} from '../features/mismatch/qualityOpacity.ts'
import { tagColorFor } from '../shared/alignmentsColor.ts'
import { basesFilterOf } from '../shared/basesFilter.ts'
import { requireReadsConf } from './configSlotViews.ts'
import { getFeatureHeightMenuItem } from './menus/featureSize.ts'
import {
  bootAlignmentsDisplay,
  clickMenuItem,
  menuSubItems,
} from './testUtils.ts'

// Boots a real LinearAlignmentsDisplay so the config-slot getters and the
// height-mode split run against the actual MST model.
//
// `displayConfig` lands on the track's own display config (`displayId: 'd1'`),
// which the view-level display then references.
function createDisplay(displayConfig: Record<string, unknown> = {}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  // no `call`: nothing here is meant to reach a fetch, so one would throw
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  const { display } = mount(Session, { configuration: 'd1' })
  return { display }
}

function presetRow(
  display: ReturnType<typeof createDisplay>['display'],
  label: string,
) {
  const row = getFeatureHeightMenuItem(display, 'read').subMenu.find(
    i => 'label' in i && i.label === label,
  )
  return row as { checked?: boolean; onClick?: () => void } | undefined
}

describe('alignments showSoftClipping', () => {
  it('is off unless the track config says otherwise', () => {
    expect(createDisplay().display.showSoftClipping).toBe(false)
    expect(
      createDisplay({ pileup: { softClips: { show: true } } }).display
        .showSoftClipping,
    ).toBe(true)
  })

  it('setShowSoftClipping writes the slot both ways', () => {
    const { display } = createDisplay({ pileup: { softClips: { show: true } } })
    display.setShowSoftClipping(false)
    expect(display.showSoftClipping).toBe(false)
    display.setShowSoftClipping(true)
    expect(display.showSoftClipping).toBe(true)
  })
})

// Compactness is featureHeight plus heightMode; spacing is derived from the
// height rather than stored.
describe('alignments compactness', () => {
  it('is Normal with no config', () => {
    const { display } = createDisplay()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('takes a per-track size from the config', () => {
    const { display } = createDisplay({ pileup: { mark: { height: 3 } } })
    expect(display.featureHeight).toBe(3)
    // spacing is derived from the height (3 -> 0)
    expect(display.featureSpacing).toBe(0)
  })

  it('the size presets select each other exclusively', () => {
    const { display } = createDisplay()
    presetRow(display, 'Super-compact')?.onClick?.()
    expect(display.featureHeight).toBe(1)
    expect(presetRow(display, 'Super-compact')?.checked).toBe(true)

    presetRow(display, 'Normal')?.onClick?.()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(presetRow(display, 'Normal')?.checked).toBe(true)
    expect(presetRow(display, 'Super-compact')?.checked).toBe(false)
  })
})

describe('alignments fit-to-display-height', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it("setHeightMode('fit') enters fit mode", () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('setReadHeight exits fit mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)

    display.setReadHeight(20)
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.heightMode).toBe('fixed')
    expect(display.configuredReadHeight).toBe(20)
  })

  // The "Custom..." height dialog edits the fixed config, so it must seed from
  // `configuredReadHeight` — the resolved `featureHeight` becomes the
  // fractional fit pitch in Compressed mode, which the dialog would then bake.
  it('exposes configured feature size independent of the fit squeeze', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(4)

    // resolved size follows the fit pitch (4px pitch = 3px body + 1px spacing)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(1)

    // ...but the configured size the dialog edits stays at the config base
    expect(display.configuredReadHeight).toBe(7)
  })
})

// pileup.mismatches.encoding.opacity fades mismatch bases by their per-base
// Phred quality, and reaches the renderers via renderState (tier-4 rerender).
describe('alignments pileup.mismatches.encoding.opacity (fade by base quality)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.mismatchOpacityField).toBeUndefined()
    expect(display.mismatchQualityOpacity).toEqual(OPAQUE_MISMATCHES)
  })

  it('setMismatchOpacityField turns the fade on and off', () => {
    const { display } = createDisplay()
    display.setMismatchOpacityField('baseQuality')
    expect(display.mismatchQualityOpacity).toEqual(DEFAULT_QUALITY_FADE)
    display.setMismatchOpacityField()
    expect(display.mismatchQualityOpacity).toEqual(OPAQUE_MISMATCHES)
  })

  it('a bare field lifts to the channel object', () => {
    const { display } = createDisplay({
      pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
    })
    expect(display.mismatchOpacityField).toBe('baseQuality')
    expect(display.mismatchQualityOpacity).toEqual(DEFAULT_QUALITY_FADE)
  })

  it('a written domain survives the toggle', () => {
    const { display } = createDisplay({
      pileup: {
        mismatches: {
          encoding: {
            opacity: { field: 'baseQuality', scale: { domain: [0, 30] } },
          },
        },
      },
    })
    expect(display.mismatchQualityOpacity.slope).toBeCloseTo(1 / 30, 10)
    display.setMismatchOpacityField()
    display.setMismatchOpacityField('baseQuality')
    expect(display.mismatchQualityOpacity.slope).toBeCloseTo(1 / 30, 10)
  })

  it('the top-level Show menu exposes the fade-by-quality toggle', () => {
    const { display } = createDisplay()
    // Top-level Show item, not nested under Advanced.
    const show = menuSubItems(display.trackMenuItems(), 'Show...')
    clickMenuItem(show, 'Fade low quality mismatches')
    expect(display.mismatchOpacityField).toBe('baseQuality')
  })
})

describe('alignments sashimi.labels.show (sashimi arc counts)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.showSashimiCounts).toBe(false)
  })

  it('setShowSashimiCounts writes the slot both ways', () => {
    const { display } = createDisplay({ sashimi: { labels: { show: true } } })
    display.setShowSashimiCounts(false)
    expect(display.showSashimiCounts).toBe(false)
    display.setShowSashimiCounts(true)
    expect(display.showSashimiCounts).toBe(true)
  })
})

describe('alignments legend.show (color key)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.showLegend).toBe(false)
  })

  // The legend's own "×" is `setShowLegend(false)` (PileupComponent).
  it('the legend "×" turns it off', () => {
    const { display } = createDisplay({ legend: { show: true } })
    expect(display.showLegend).toBe(true)
    display.setShowLegend(false)
    expect(display.showLegend).toBe(false)
  })
})

// `grow` is the third value of the shared `heightMode` vocabulary (with the
// canvas display): the track resizes to fit all reads rather than scrolling
// (fixed) or shrinking reads (fit). autoHeight/fitHeightToDisplay are mutually
// exclusive views of the one slot.
describe('alignments grow (auto-height) mode', () => {
  it('is off by default and mutually exclusive with fit', () => {
    const { display } = createDisplay()
    expect(display.autoHeight).toBe(false)

    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    expect(display.fitHeightToDisplay).toBe(false)

    display.setHeightMode('fit')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(true)

    display.setHeightMode('fixed')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('caps the grown height at GROW_MAX_HEIGHT (800)', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    // no fetched reads -> content is just the coverage band, well under the cap
    expect(display.grownHeight).toBeLessThanOrEqual(800)
  })

  it('a manual drag-resize exits grow mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
  })

  it('picking a size keeps grow mode (grows at the new size)', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.setReadHeight(3)
    expect(display.autoHeight).toBe(true)
    expect(display.configuredReadHeight).toBe(3)
  })
})

// The fit split: while fit is on, featureHeight/featureSpacing don't read the
// config slots — they carve the autorun-cached fit pitch (`fittedHeightPx` =
// pileupSpace/rows) into a read body plus spacing. Here we drive `fittedHeightPx`
// directly (the driving autorun leaves it at 0 with no fetched reads, and
// nothing it tracks changes when we set it, so the value sticks) to exercise the
// split the layout/GPU/SVG consumers actually see. The invariant under test is
// body + spacing === pitch, so the pileup fills the display exactly.
describe('alignments fit-to-display-height split', () => {
  it('with nothing to fit, fittedFeatureHeight is 0 and size falls back to config', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    // no fetched reads -> no rows -> nothing to fit
    expect(display.fittedFeatureHeight).toBe(0)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('spares a 1px gap once the pitch clears 3px, body fills the rest', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(9)
    // body + spacing reconstructs the pitch exactly
    expect(display.featureHeight + display.featureSpacing).toBe(10)
  })

  it('keeps reads flush (no spacing) at a 3px pitch or tighter', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(3)

    display.setFittedHeightPx(2)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(2)
  })

  it('splits a fractional pitch without losing the fill (body stays fractional)', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3.5)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(2.5)
    expect(display.featureHeight + display.featureSpacing).toBe(3.5)
  })

  it('ignores a stale fit cache once fit is off', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureHeight).toBe(9)

    // leaving fit doesn't reset the cache, but the getters gate on fit mode so
    // the config values win again
    display.setHeightMode('fixed')
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })
})

describe('alignments colorField', () => {
  it('is normal with no config', () => {
    const { display } = createDisplay()
    expect(display.colorField).toBeUndefined()
  })

  it('takes an explicit per-track color field', () => {
    const { display } = createDisplay({
      encoding: { color: { field: 'strand' } },
    })
    expect(display.colorField).toBe('strand')
  })

  it('reads a tag and an attribute off the config', () => {
    expect(
      createDisplay({ encoding: { color: { field: 'tags.HP' } } }).display
        .colorField,
    ).toBe('tags.HP')
    expect(
      createDisplay({ encoding: { color: { field: 'score' } } }).display
        .colorField,
    ).toBe('score')
  })

  it('draws a per-base layer beside whatever fills the reads', () => {
    const { display } = createDisplay({
      encoding: { color: { field: 'tags.HP' } },
      pileup: {
        bases: {
          show: true,
          encoding: { color: 'modifications' },
          filter: [{ field: 'probability', gte: 0.5 }],
        },
      },
    })
    expect(display.colorField).toBe('tags.HP')
    expect(display.baseLayer).toEqual({
      field: 'modifications',
      unmodified: false,
      filter: basesFilterOf([{ field: 'probability', gte: 0.5 }]),
    })
    expect(display.bodyColorKind).toBe('tag')
    expect(display.showModifications).toBe(true)
    expect(display.rpcProps()).toMatchObject({
      colorField: 'tags.HP',
      baseLayer: { field: 'modifications' },
    })
  })

  it('the methylation view draws its calls, with the fill unmarked', () => {
    const { display } = createDisplay({
      pileup: {
        bases: {
          show: true,
          encoding: { color: 'modifications' },
          unmodified: { show: true },
        },
      },
    })
    expect(display.showModifications).toBe(true)
    expect(display.rpcProps()).toMatchObject({
      colorField: undefined,
      baseLayer: {
        field: 'modifications',
        unmodified: true,
      },
    })
  })

  it('a per-base variable on the read fill paints the plain fill', () => {
    const { display } = createDisplay({
      encoding: { color: { field: 'modifications' } },
    })
    expect(display.colorField).toBeUndefined()
    expect(display.rpcProps()).toMatchObject({ colorField: undefined })
  })

  it('a per-base layer names one of its four variables', () => {
    expect(() =>
      createDisplay({
        pileup: { bases: { encoding: { color: 'methylation' } } },
      }),
    ).toThrow(/methylation/)
  })

  it('a modification layer over the plain fill tints the body by strand', () => {
    const { display } = createDisplay({
      pileup: {
        bases: { show: true, encoding: { color: { field: 'bisulfite' } } },
      },
    })
    expect(display.colorField).toBeUndefined()
    expect(display.bodyColorKind).toBe('bisulfite')
  })

  it('a read pick leaves the layer alone, and the layer has its own way off', () => {
    const { display } = createDisplay({
      pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
    })
    display.colorByField('strand')
    expect(display.baseLayer?.field).toBe('modifications')
    display.setBases({ show: true, field: 'baseQuality' })
    expect(display.colorField).toBe('strand')
    expect(display.showPerBaseQuality).toBe(true)
    display.setBases({ show: false })
    expect(display.baseLayer).toBeUndefined()
  })

  it('None hides the layer and keeps its field for the way back', () => {
    const { display } = createDisplay({
      pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
    })
    display.setBases({ show: false })
    expect(display.baseLayer).toBeUndefined()
    const conf = requireReadsConf(display)
    expect(readConfObject(conf, ['pileup', 'bases', 'show'])).toBe(false)
    expect(
      readConfObject(conf, ['pileup', 'bases', 'encoding', 'color', 'field']),
    ).toBe('modifications')
    display.setBases({ show: true })
    expect(display.baseLayer?.field).toBe('modifications')
  })

  it('a named field draws no layer while bases.show is off', () => {
    const { display } = createDisplay({
      pileup: { bases: { encoding: { color: 'modifications' } } },
    })
    expect(display.baseLayer).toBeUndefined()
    display.setBases({ show: true, field: 'base' })
    expect(display.baseLayer?.field).toBe('base')
    expect(
      readConfObject(requireReadsConf(display), ['pileup', 'bases', 'show']),
    ).toBe(true)
  })

  it('a ramp with its ends reversed is a notice', () => {
    const { display } = createDisplay({
      encoding: {
        color: {
          field: 'tags.XS',
          scale: { type: 'linear', domainMin: 10, domainMax: 1 },
        },
      },
    })
    expect(display.notices).toEqual([
      expect.stringMatching(
        /^encoding\.color\.scale\.domainMax: domainMax is below domainMin/,
      ),
    ])
  })

  it('a string is the field, and value the constant read fill', () => {
    expect(
      createDisplay({ encoding: { color: 'strand' } }).display.colorField,
    ).toBe('strand')
    expect(() =>
      createDisplay({ encoding: { color: 'rgb(0, 0, 255)' } }),
    ).toThrow(/is a color, and a bare string is the field/)
    const { display } = createDisplay({
      encoding: { color: { value: 'rgb(0, 0, 255)' } },
    })
    expect(display.colorField).toBeUndefined()
    expect(display.colorSetting.value).toBe('rgb(0, 0, 255)')
  })

  it('picking a field writes it and keeps a declared range for the way back', () => {
    const { display } = createDisplay({
      encoding: {
        color: { field: 'tags.HP', scale: { range: ['red', 'blue'] } },
      },
    })
    display.colorByField(undefined)
    expect(display.colorField).toBeUndefined()
    expect(display.parkedColor?.field).toBe('tags.HP')
    display.colorByField('tags.HP')
    expect(display.colorSetting.scale.range).toEqual(['red', 'blue'])
    display.colorByField('strand')
    expect(display.colorSetting).toMatchObject({
      field: 'strand',
      scale: { range: [] },
    })
  })

  it('Normal and back keeps a tag and its members, its scale included', () => {
    const color = {
      field: 'tags.NM',
      scale: { type: 'linear', range: ['#ffffff', '#000000'], domainMin: 0 },
    }
    const { display } = createDisplay({ encoding: { color } })
    expect(display.bakedColorScale?.kind).toBe('linear')
    display.colorByField(undefined)
    expect(display.bakedColorScale).toBeUndefined()
    display.colorByField('tags.NM')
    expect(display.colorSetting).toMatchObject({
      field: 'tags.NM',
      scale: { type: 'linear', range: ['#ffffff', '#000000'], domainMin: 0 },
    })
  })

  it('the Tag dialog picks a gradient or a color per value', () => {
    const { display } = createDisplay({
      encoding: {
        color: {
          field: 'tags.NM',
          scale: {
            type: 'linear',
            range: ['#ffffff', '#000000'],
            domainMin: 0,
          },
        },
      },
    })
    display.colorByField(undefined)
    display.applyPlot({
      encoding: {
        color: tagColorFor(
          display.writtenColor,
          'NM',
          'linear',
          display.parkedColor,
        ),
      },
    })
    expect(display.bakedColorScale?.kind).toBe('linear')
    expect(display.colorSetting).toMatchObject({
      scale: { range: ['#ffffff', '#000000'], domainMin: 0 },
    })
    display.applyPlot({
      encoding: {
        color: tagColorFor(display.writtenColor, 'NM', 'ordinal'),
      },
    })
    expect(display.colorSetting.scale.type).toBeUndefined()
  })

  it('leaving pairs and coming back keeps a pinned insert-size band', () => {
    const { display } = createDisplay({
      encoding: {
        color: {
          field: 'insertSizeAndOrientation',
          scale: { domain: ['150', '600'] },
        },
      },
    })
    display.setUnit('chain')
    display.setUnit('read')
    expect(display.colorField).toBeUndefined()
    display.setUnit('chain')
    expect(display.pinnedInsertSizeBand).toEqual({ lower: 150, upper: 600 })
  })

  it('an undeclared key in the color object is named, and a write of one refused', () => {
    const { display } = createDisplay({
      encoding: { color: { type: 'strand' } },
    })
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Color does not declare type: loading without it$/),
    )
    expect(() => {
      setConf(display, ['encoding', 'color'], { type: 'strand' })
    }).toThrow('not type')
  })

  it('pins the insert-size cut points from the domain', () => {
    const { display } = createDisplay({
      encoding: {
        color: { field: 'insertSize', scale: { domain: ['150', '600'] } },
      },
    })
    expect(display.pinnedInsertSizeBand).toEqual({ lower: 150, upper: 600 })
  })

  it('an insert-size domain is the cuts of the threshold its field defaults to', () => {
    const { display } = createDisplay({
      encoding: {
        color: { field: 'insertSize', scale: { domain: ['600', '150'] } },
      },
    })
    expect(display.pinnedInsertSizeBand).toEqual({ lower: 150, upper: 600 })
  })

  it('under an ordinal scale an insert-size domain orders and pins nothing', () => {
    const { display } = createDisplay({
      encoding: {
        color: {
          field: 'insertSize',
          scale: { type: 'ordinal', domain: ['150', '600'] },
        },
      },
    })
    expect(display.pinnedInsertSizeBand).toBeUndefined()
  })

  // Leaving pairs mode discards the now-meaningless pairing field.
  it('leaving pairs resets the color field to the plain fill', () => {
    const { display } = createDisplay()
    display.setUnit('chain')
    expect(display.colorField).toBe('insertSizeAndOrientation')

    display.setUnit('read')
    expect(display.colorField).toBeUndefined()
  })
})

describe('alignments unit (view as pairs)', () => {
  it('is read with no config', () => {
    const { display } = createDisplay()
    expect(display.unit).toBe('read')
  })

  it('setUnit writes the slot both ways', () => {
    const { display } = createDisplay()
    display.setUnit('chain')
    expect(display.unit).toBe('chain')
    display.setUnit('read')
    expect(display.unit).toBe('read')
  })

  it('is part of the plot, so applyPlot and "Edit plot..." reach it', () => {
    const { display } = createDisplay()
    display.applyPlot({ unit: 'chain' })
    expect(display.plot.unit).toBe('chain')
  })
})

describe('alignments readConnections (arcs)', () => {
  it('is off with no config', () => {
    const { display } = createDisplay()
    expect(display.drawnReadConnections).toBe('off')
  })

  it('takes an explicit per-track overlay', () => {
    const { display } = createDisplay({
      readConnections: { show: true, mark: 'rule' },
    })
    expect(display.drawnReadConnections).toBe('cloud')
  })

  it('keeps its mark while hidden', () => {
    const { display } = createDisplay({
      readConnections: { show: true, mark: 'rule' },
    })
    display.setDrawnReadConnections('off')
    expect(display.drawnReadConnections).toBe('off')
    expect(display.readConnectionsMark).toBe('cloud')
  })
})

test('a layer filter test its layer does not make is a notice', () => {
  const { display } = createDisplay({
    coverage: {
      interbase: { filter: [{ field: 'depth', lte: 4 }] },
      alleles: { filter: [{ field: 'fraction', gt: 0.2 }] },
    },
    pileup: { bases: { filter: [{ field: 'probability', gte: 50 }] } },
  })
  expect(display.configNotices).toEqual([
    'coverage.interbase.filter: depth takes gte or gt, not {"field":"depth","lte":4}',
    'coverage.alleles.filter: fraction takes gte, not {"field":"fraction","gt":0.2}',
    'pileup.bases.filter: probability runs from 0 to 1, not {"field":"probability","gte":50}',
  ])
})

test('the interbase filter reaches the worker, each field over its default', () => {
  const { display } = createDisplay({
    coverage: { interbase: { filter: [{ field: 'depth', gte: 2 }] } },
  })
  expect(display.rpcProps().interbaseIndicators).toEqual({
    depth: { min: 2, strict: false },
    fraction: { min: 0.3, strict: true },
  })
  display.setCoverageMinAlleleFraction(0.05)
  expect(display.coverageMinAlleleFraction).toBe(0.05)
  expect(
    readConfObject(display.configuration, ['coverage', 'alleles', 'filter']),
  ).toMatchObject([{ field: 'fraction', gte: 0.05 }])
})
