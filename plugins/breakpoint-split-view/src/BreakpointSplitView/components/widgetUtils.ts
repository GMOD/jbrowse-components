import type { Feature, SessionWithWidgets } from '@jbrowse/core/util'

export function showVariantFeatureWidget(
  session: SessionWithWidgets,
  feature?: Feature,
) {
  const featureWidget = session.addWidget(
    'VariantFeatureWidget',
    'variantFeature',
    {
      featureData: feature?.toJSON(),
    },
  )
  session.showWidget(featureWidget)
}

export function showBreakpointAlignmentsWidget(
  session: SessionWithWidgets,
  feature1?: Feature,
  feature2?: Feature,
) {
  const featureWidget = session.addWidget(
    'BreakpointAlignmentsWidget',
    'breakpointAlignments',
    {
      featureData: {
        feature1: (feature1 || { toJSON: () => {} }).toJSON(),
        feature2: (feature2 || { toJSON: () => {} }).toJSON(),
      },
    },
  )
  session.showWidget(featureWidget)
}
