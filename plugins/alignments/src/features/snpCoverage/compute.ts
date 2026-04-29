// SNP-coverage compute lives in alignments-core (groups mismatches by
// position, stacks A/C/G/T heights normalized by maxDepth). Re-exported
// here so the orchestrator (runCoveragePipeline) imports from the feature
// folder rather than the core package directly.
export { computeSNPCoverage } from '@jbrowse/alignments-core'
