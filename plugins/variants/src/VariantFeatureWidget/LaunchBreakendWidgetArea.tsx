import { Suspense, lazy } from 'react'

import { parseBreakend } from '@gmod/vcf'

import type { VariantFeatureWidgetModel } from './stateModelFactory'

// lazies
const LaunchBreakendPanel = lazy(() => import('./LaunchBreakendPanel'))

export default function LaunchBreakendWidgetArea({
  model,
}: {
  model: VariantFeatureWidgetModel
}) {
  const { featureData } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { type = '' } = feat

  return (
    <Suspense fallback={null}>
      {type === 'breakend' ? (
        <LaunchBreakendPanel
          feature={feat}
          locStrings={feat.ALT.map(
            (alt: string) => parseBreakend(alt)?.MatePosition || '',
          )}
          model={model}
        />
      ) : type === 'translocation' ? (
        <LaunchBreakendPanel
          feature={feat}
          model={model}
          locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
        />
      ) : type === 'paired_feature' ? (
        <LaunchBreakendPanel
          feature={feat}
          model={model}
          locStrings={[`${feat.mate.refName}:${feat.mate.start}`]}
        />
      ) : type.includes('inversion') ||
        type.includes('deletion') ||
        type.includes('duplication') ||
        type.includes('cnv') ||
        type.includes('sv') ? (
        <LaunchBreakendPanel
          feature={{
            uniqueId: 'random',
            refName: feat.refName,
            start: feat.start,
            end: feat.start + 1,
            mate: {
              refName: feat.refName,
              start: feat.end,
              end: feat.end + 1,
            },
          }}
          model={model}
          locStrings={[`${feat.refName}:${feat.end}`]}
        />
      ) : null}
    </Suspense>
  )
}
