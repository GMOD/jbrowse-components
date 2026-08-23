import { COVERAGE_INTERBASE_PASS } from '@jbrowse/render-core/coverageBand'

// Shared with the MAF band — see features/coverage/packGpu.ts.
//
// `interbaseCov*` / `interbasePackedBuffer` are the coverage-area arrays; the
// plain `interbase*` ones on CigarUploadData are the row-instanced marks, a
// different pass.
export const INTERBASE_PASS = COVERAGE_INTERBASE_PASS
