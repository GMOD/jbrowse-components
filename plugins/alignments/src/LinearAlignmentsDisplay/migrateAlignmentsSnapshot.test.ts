import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'

describe('migrateAlignmentsSnapshot', () => {
  test('returns snapshot unchanged when no migration needed', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      configuration: 'track-1',
      showCoverage: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
    expect(result.showCoverage).toBe(true)
  })

  test('strips blockState, showTooltips but keeps userByteSizeLimit', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      blockState: { key: 'value' },
      showTooltips: true,
      userByteSizeLimit: 5000000,
      showCoverage: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result).not.toHaveProperty('blockState')
    expect(result).not.toHaveProperty('showTooltips')
    expect(result.userByteSizeLimit).toBe(5000000)
    expect(result.showCoverage).toBe(true)
  })

  // height/heightPreConfig → heightOverride is migrated centrally by
  // TrackHeightMixin (see TrackHeightMixin.test.ts); this function leaves
  // height untouched.

  test('migrates arcsHeight → readConnectionsHeight', () => {
    const snap = { type: 'LinearAlignmentsDisplay', arcsHeight: 60 }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.readConnectionsHeight).toBe(60)
    expect(result).not.toHaveProperty('arcsHeight')
  })

  test('remaps LinearPileupDisplay → LinearAlignmentsDisplay', () => {
    const snap = {
      type: 'LinearPileupDisplay',
      displayId: 'pileup-1',
      mismatchAlpha: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
    expect(result.displayId).toBe('pileup-1')
    expect(result.mismatchAlpha).toBe(true)
  })

  test('remaps LinearReadArcsDisplay → LinearAlignmentsDisplay', () => {
    const snap = { type: 'LinearReadArcsDisplay', displayId: 'arcs-1' }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
  })

  test('remaps LinearReadCloudDisplay → LinearAlignmentsDisplay', () => {
    const snap = { type: 'LinearReadCloudDisplay', displayId: 'cloud-1' }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
  })

  test('migrates renderingMode linkedRead → linkedReads enum', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'linkedRead',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.linkedReads).toBe('normal')
    expect(result).not.toHaveProperty('showLinkedReads')
    expect(result.colorBy).toEqual({ type: 'insertSizeAndOrientation' })
    expect(result).not.toHaveProperty('renderingMode')
  })

  test('migrates renderingMode cloud → linkedReads enum', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'cloud',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.linkedReads).toBe('normal')
  })

  test('migrates renderingMode pileup → linkedReads off', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'pileup',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.linkedReads).toBe('off')
    expect(result).not.toHaveProperty('renderingMode')
  })

  test('preserves existing colorBySetting during renderingMode migration', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'linkedRead',
      colorBySetting: { type: 'strand' },
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.colorBy).toEqual({ type: 'strand' })
  })

  test('migrates showReadCloud → linkedReads enum', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      showReadCloud: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.linkedReads).toBe('normal')
    expect(result).not.toHaveProperty('showReadCloud')
    expect(result).not.toHaveProperty('showLinkedReads')
  })

  test('migrates nested PileupDisplay/SNPCoverageDisplay format', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      PileupDisplay: {
        showSoftClipping: true,
        colorBy: { type: 'strand' },
        filterBy: { flagInclude: 0 },
      },
      SNPCoverageDisplay: {},
      snpCovHeight: 60,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.showSoftClipping).toBe(true)
    expect(result.colorBy).toEqual({ type: 'strand' })
    expect(result.filterBy).toEqual({ flagInclude: 0 })
    expect(result.coverageHeight).toBe(60)
    expect(result).not.toHaveProperty('PileupDisplay')
    expect(result).not.toHaveProperty('SNPCoverageDisplay')
    expect(result).not.toHaveProperty('snpCovHeight')
  })

  test('migrates LinearSNPCoverageDisplay type and properties', () => {
    const snap = {
      type: 'LinearSNPCoverageDisplay',
      displayId: 'snpcov-1',
      showArcs: false,
      showInterbaseIndicators: false,
      colorBySetting: { type: 'strand' },
      filterBySetting: { flagInclude: 0 },
      jexlFilters: ['filter1'],
      minArcScore: 10,
      showInterbaseCounts: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
    expect(result.showSashimiArcs).toBe(false)
    expect(result).not.toHaveProperty('sashimiArcs')
    expect(result.showInterbaseIndicators).toBe(false)
    expect(result.showCoverage).toBe(true)
    expect(result.coverageHeight).toBe(45)
    expect(result.showMismatches).toBe(true)
    expect(result.colorBy).toEqual({ type: 'strand' })
    expect(result.filterBy).toEqual({ flagInclude: 0 })
    expect(result).not.toHaveProperty('jexlFilters')
    expect(result).not.toHaveProperty('minArcScore')
    expect(result).not.toHaveProperty('showInterbaseCounts')
  })

  test('full old LinearPileupDisplay snapshot migration', () => {
    const snap = {
      type: 'LinearPileupDisplay',
      displayId: 'pileup-1',
      height: 300,
      blockState: { block1: {} },
      showTooltips: true,
      renderingMode: 'linkedRead',
      mismatchAlpha: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.type).toBe('LinearAlignmentsDisplay')
    // height passes through untouched (TrackHeightMixin migrates it)
    expect(result.height).toBe(300)
    expect(result.linkedReads).toBe('normal')
    expect(result).not.toHaveProperty('showLinkedReads')
    expect(result.mismatchAlpha).toBe(true)
    expect(result.colorBy).toEqual({ type: 'insertSizeAndOrientation' })
    expect(result).not.toHaveProperty('blockState')
    expect(result).not.toHaveProperty('showTooltips')
    expect(result).not.toHaveProperty('renderingMode')
  })

  test('migrates individual override properties to flat keys', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      featureHeight: 5,
      noSpacing: true,
      trackMaxHeight: 800,
      showOutline: false,
      showLegend: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.featureHeight).toBe(5)
    expect(result.featureSpacing).toBe(0)
    expect(result.maxHeight).toBe(800)
    expect(result.showOutline).toBe(false)
    expect(result.showLegend).toBe(true)
    expect(result).not.toHaveProperty('noSpacing')
    expect(result).not.toHaveProperty('trackMaxHeight')
  })

  test('migrates lineWidthSetting → readConnectionsLineWidth', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      lineWidthSetting: 3,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.readConnectionsLineWidth).toBe(3)
    expect(result).not.toHaveProperty('lineWidthSetting')
  })

  // Released LinearReadArcsDisplay sessions persisted bare `lineWidth` (no
  // Setting suffix) — it must reach the new readConnectionsLineWidth.
  test('migrates released lineWidth → readConnectionsLineWidth', () => {
    const result = migrateAlignmentsSnapshot({
      type: 'LinearReadArcsDisplay',
      lineWidth: 4,
    })
    expect(result.readConnectionsLineWidth).toBe(4)
    expect(result).not.toHaveProperty('lineWidth')
  })

  test('folds showLinkedReads+showLinkedReadsAsBeziers booleans into linkedReads enum', () => {
    const off = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showLinkedReads: false,
      showLinkedReadsAsBeziers: false,
    })
    expect(off.linkedReads).toBe('off')
    expect(off).not.toHaveProperty('showLinkedReads')
    expect(off).not.toHaveProperty('showLinkedReadsAsBeziers')

    const normal = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showLinkedReads: true,
      showLinkedReadsAsBeziers: false,
    })
    expect(normal.linkedReads).toBe('normal')

    // Bezier is now an overlay orthogonal to layout: the old chain+bezier
    // state migrates to the ideal pileup + curves look.
    const bezier = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showLinkedReads: true,
      showLinkedReadsAsBeziers: true,
    })
    expect(bezier.linkedReads).toBe('off')
    expect(bezier.showBezierConnections).toBe(true)
  })

  test('migrates enum-era linkedReads:bezier to the overlay flag', () => {
    const migrated = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      linkedReads: 'bezier',
    })
    expect(migrated.linkedReads).toBe('off')
    expect(migrated.showBezierConnections).toBe(true)
  })

  test('folds showArcs+pairedArcsDown booleans into readConnections', () => {
    const off = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showArcs: false,
      pairedArcsDown: true,
    })
    expect(off.readConnections).toBe('off')
    expect(off.readConnectionsDown).toBe(false)
    expect(off).not.toHaveProperty('showArcs')
    expect(off).not.toHaveProperty('pairedArcsDown')
    expect(off).not.toHaveProperty('pairedArcs')

    const up = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showArcs: true,
      pairedArcsDown: false,
    })
    expect(up.readConnections).toBe('arc')
    expect(up.readConnectionsDown).toBe(false)

    const down = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showArcs: true,
      pairedArcsDown: true,
    })
    expect(down.readConnections).toBe('arc')
    expect(down.readConnectionsDown).toBe(true)
  })

  test('splits pairedArcs enum into readConnections + direction', () => {
    const samplot = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      pairedArcs: 'samplot',
    })
    expect(samplot.readConnections).toBe('samplot')
    expect(samplot.readConnectionsDown).toBe(false)
    expect(samplot).not.toHaveProperty('pairedArcs')

    const down = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      pairedArcs: 'down',
    })
    expect(down.readConnections).toBe('arc')
    expect(down.readConnectionsDown).toBe(true)
  })

  test('migrates legacy arcColorByType=samplot to readConnections=samplot', () => {
    const result = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      arcColorByType: 'samplot',
      pairedArcs: 'up',
    })
    expect(result.readConnections).toBe('samplot')
    expect(result.arcColorByType).toBe('insertSizeAndOrientation')
  })

  test('leaves non-samplot arcColorByType untouched', () => {
    const result = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      arcColorByType: 'insertSize',
      pairedArcs: 'down',
    })
    expect(result.arcColorByType).toBe('insertSize')
    expect(result.readConnections).toBe('arc')
    expect(result.readConnectionsDown).toBe(true)
  })

  test('passes showSashimiArcs through and drops per-feature sashimiArcsDown', () => {
    // showSashimiArcs is already the current field name — it survives.
    const off = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showSashimiArcs: false,
    })
    expect(off.showSashimiArcs).toBe(false)

    // Direction is now the shared readConnectionsDown, so the old per-feature
    // sashimiArcsDown is discarded.
    const dropped = migrateAlignmentsSnapshot({
      type: 'LinearAlignmentsDisplay',
      showSashimiArcs: true,
      sashimiArcsDown: true,
    })
    expect(dropped.showSashimiArcs).toBe(true)
    expect(dropped).not.toHaveProperty('sashimiArcsDown')
    expect(dropped).not.toHaveProperty('sashimiArcs')
  })

  test('migrates sortedBySetting → flat sortedBy', () => {
    const sorted = {
      type: 'base',
      pos: 100,
      refName: 'chr1',
      assemblyName: 'hg38',
    }
    const snap = {
      type: 'LinearAlignmentsDisplay',
      sortedBySetting: sorted,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.sortedBy).toEqual(sorted)
    expect(result).not.toHaveProperty('sortedBySetting')
  })

  // Released LinearPileupDisplay sessions persisted bare `sortedBy` (no Setting
  // suffix); it must reach the new sortedBy field.
  test('migrates released sortedBy (from LinearPileupDisplay) to flat sortedBy', () => {
    const sorted = { type: 'Start location' }
    const result = migrateAlignmentsSnapshot({
      type: 'LinearPileupDisplay',
      sortedBy: sorted,
    })
    expect(result.sortedBy).toEqual(sorted)
  })
})
