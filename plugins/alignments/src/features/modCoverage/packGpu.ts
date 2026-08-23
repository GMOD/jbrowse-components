import { COVERAGE_MOD_PASS } from '@jbrowse/render-core/coverageBand'

// The one coverage-band pass with a single producer: a MAF alignment carries no
// modification calls, so MAF's band draws the other four. The shader still lives
// in render-core beside them, because it stacks in the same bars off the same
// band geometry. See features/coverage/packGpu.ts.
export const MOD_COVERAGE_PASS = COVERAGE_MOD_PASS

export { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'
