import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pileupDataFromSamRecords } from '../../plugins/alignments/src/LinearAlignmentsDisplay/samRecordFixture.ts'
import { computeReadChains } from '../../plugins/alignments/src/features/arcs/arcChains.ts'
import { computeDerivativePaths } from '../../plugins/alignments/src/features/derivativePaths/computePaths.ts'
import { letterSegments } from '../../plugins/alignments/src/features/derivativePaths/letterSegments.ts'
import {
  COLO829_REGION,
  COLO829_TUMOUR,
} from '../../plugins/alignments/src/features/derivativePaths/realReads.colo829.fixture.ts'
import { segmentMapSvg } from '../../plugins/linear-comparative-view/src/LinearDerivativeVsRef/segmentMapSvg.ts'
import { isDerivedFigure } from './figure-store.ts'

// The segment map the picker's "Save segment map" button writes, drawn here for
// the tutorial from the same committed reads `realReads.colo829.test.ts` pins:
// the reads are grouped into routes, the top route is lettered, and the figure
// is the SVG the button would save. A derived figure like the thumbs beside it,
// so every build redraws it and no stored copy can fall behind the code.

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = 'segment-maps/'

const MAPS = {
  'cancer_sv_der3.svg': () => {
    const chains = computeReadChains(
      [new Map([[0, pileupDataFromSamRecords(COLO829_TUMOUR)]])],
      [COLO829_REGION],
    )
    const [top] = computeDerivativePaths({ chains })
    if (!top) {
      throw new Error('the COLO829 fixture yields no derivative path')
    }
    return segmentMapSvg(top, letterSegments(top.observedSegments), 'reads')
  },
}

mkdirSync(join(websiteRoot, 'static/img', outDir), { recursive: true })
for (const [file, draw] of Object.entries(MAPS)) {
  const rel = `${outDir}${file}`
  if (!isDerivedFigure(rel, 'website/static/img')) {
    throw new Error(
      `${rel} is not named as a derived figure in figure-store.ts`,
    )
  }
  writeFileSync(join(websiteRoot, 'static/img', rel), draw())
  console.log(`wrote static/img/${rel}`)
}
