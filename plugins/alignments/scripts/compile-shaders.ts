import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import {
  GAP_WGSL,
  HARDCLIP_WGSL,
  INSERTION_WGSL,
  MISMATCH_WGSL,
  MODIFICATION_WGSL,
  SOFTCLIP_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/cigarShaders.ts'
import {
  COVERAGE_WGSL,
  INDICATOR_WGSL,
  MOD_COVERAGE_WGSL,
  NONCOV_HISTOGRAM_WGSL,
  SEPARATOR_LINE_WGSL,
  SNP_COVERAGE_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/coverageShaders.ts'
import {
  ARC_LINE_WGSL,
  ARC_WGSL,
  CONNECTING_LINE_WGSL,
  SASHIMI_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/miscShaders.ts'
import { READ_WGSL } from '../src/LinearAlignmentsDisplay/components/wgsl/readShader.ts'

compileShaders({
  shaders: [
    { name: 'READ', wgsl: READ_WGSL },
    { name: 'GAP', wgsl: GAP_WGSL },
    { name: 'MISMATCH', wgsl: MISMATCH_WGSL },
    { name: 'INSERTION', wgsl: INSERTION_WGSL },
    { name: 'SOFTCLIP', wgsl: SOFTCLIP_WGSL },
    { name: 'HARDCLIP', wgsl: HARDCLIP_WGSL },
    { name: 'MODIFICATION', wgsl: MODIFICATION_WGSL },
    { name: 'COVERAGE', wgsl: COVERAGE_WGSL },
    { name: 'SNP_COVERAGE', wgsl: SNP_COVERAGE_WGSL },
    { name: 'MOD_COVERAGE', wgsl: MOD_COVERAGE_WGSL },
    { name: 'NONCOV_HISTOGRAM', wgsl: NONCOV_HISTOGRAM_WGSL },
    { name: 'INDICATOR', wgsl: INDICATOR_WGSL },
    { name: 'SEPARATOR_LINE', wgsl: SEPARATOR_LINE_WGSL },
    { name: 'ARC', wgsl: ARC_WGSL },
    { name: 'ARC_LINE', wgsl: ARC_LINE_WGSL },
    { name: 'SASHIMI', wgsl: SASHIMI_WGSL },
    { name: 'CONNECTING_LINE', wgsl: CONNECTING_LINE_WGSL },
  ],
  outDir: path.join(
    import.meta.dirname,
    '..',
    'src',
    'LinearAlignmentsDisplay',
    'components',
    'shaders',
    'generated',
  ),
  header: 'Do not edit manually - edit the WGSL sources in wgsl/ instead',
})
