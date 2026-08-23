import { COVERAGE_SNP_PASS } from '@jbrowse/render-core/coverageBand'

// Shared with the MAF band — see features/coverage/packGpu.ts. Written
// worker-side by `computeSNPCoverage`, which fills the shader's layout directly
// rather than building parallel arrays to pack from, and uploaded verbatim.
export const SNP_COVERAGE_PASS = COVERAGE_SNP_PASS
