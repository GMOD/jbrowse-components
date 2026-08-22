import { createDisplayTestEnvironment as createSharedEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// The shared display harness wired for the variant display family. Each display
// wraps this with its own factories and instance type (LDDisplay/testEnv.ts,
// LinearMultiSampleVariantMatrixDisplay/testEnv.ts) — the geometry getters they
// test (viewTransform, connectorLineCoords, columnGeometry) all read the
// containing view, so a bare `stateModel.create()` can't reach them.
//
// Takes a built `configSchema` and `stateModel` rather than the factories,
// because each caller builds its own pair before handing them over.
export function createDisplayTestEnvironment<T>({
  displayName,
  configSchema,
  stateModel,
}: {
  displayName: string
  configSchema: AnyConfigurationSchemaType
  stateModel: IAnyModelType
}) {
  return createSharedEnvironment<T>({
    trackType: 'VariantTrack',
    displayName,
    configSchema: () => configSchema,
    stateModel: () => stateModel,
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 10_000_000,
  })
}
