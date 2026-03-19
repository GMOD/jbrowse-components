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

  test('strips blockState, showTooltips, userByteSizeLimit', () => {
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
    expect(result).not.toHaveProperty('userByteSizeLimit')
    expect(result.showCoverage).toBe(true)
  })

  test('migrates height → heightPreConfig', () => {
    const snap = { type: 'LinearAlignmentsDisplay', height: 400 }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.heightPreConfig).toBe(400)
    expect(result).not.toHaveProperty('height')
  })

  test('does not overwrite existing heightPreConfig', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      height: 400,
      heightPreConfig: 300,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.heightPreConfig).toBe(300)
    expect(result.height).toBe(400)
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

  test('migrates renderingMode linkedRead → showLinkedReads', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'linkedRead',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.showLinkedReads).toBe(true)
    expect(result.colorBySetting).toEqual({
      type: 'insertSizeAndOrientation',
    })
    expect(result).not.toHaveProperty('renderingMode')
  })

  test('migrates renderingMode cloud → showLinkedReads', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'cloud',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.showLinkedReads).toBe(true)
  })

  test('migrates renderingMode pileup → showLinkedReads false', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'pileup',
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.showLinkedReads).toBe(false)
    expect(result).not.toHaveProperty('renderingMode')
  })

  test('preserves existing colorBySetting during renderingMode migration', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      renderingMode: 'linkedRead',
      colorBySetting: { type: 'strand' },
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.colorBySetting).toEqual({ type: 'strand' })
  })

  test('migrates showReadCloud → showLinkedReads', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      showReadCloud: true,
    }
    const result = migrateAlignmentsSnapshot(snap)
    expect(result.showLinkedReads).toBe(true)
    expect(result).not.toHaveProperty('showReadCloud')
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
    expect(result.colorBySetting).toEqual({ type: 'strand' })
    expect(result.filterBySetting).toEqual({ flagInclude: 0 })
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
    expect(result.showInterbaseIndicators).toBe(false)
    expect(result.showCoverage).toBe(true)
    expect(result.coverageHeight).toBe(45)
    expect(result.showMismatches).toBe(true)
    expect(result.colorBySetting).toEqual({ type: 'strand' })
    expect(result.jexlFilters).toEqual(['filter1'])
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
    expect(result.heightPreConfig).toBe(300)
    expect(result.showLinkedReads).toBe(true)
    expect(result.mismatchAlpha).toBe(true)
    expect(result).not.toHaveProperty('blockState')
    expect(result).not.toHaveProperty('showTooltips')
    expect(result).not.toHaveProperty('height')
    expect(result).not.toHaveProperty('renderingMode')
  })
})
