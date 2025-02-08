import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

export default function MultiVariantTooltip({
  source,
}: {
  source: { color?: string; [key: string]: unknown }
}) {
  return (
    <BaseTooltip>
      {source.color ? (
        <div
          style={{
            width: 10,
            height: 10,
            backgroundColor: source.color,
          }}
        />
      ) : null}
      <SanitizedHTML
        html={Object.entries(source)
          .filter(
            ([key, val]) =>
              key !== 'color' &&
              key !== 'name' &&
              key !== 'HP' &&
              key !== 'id' &&
              val !== undefined,
          )
          .map(([key, value]) => `${key}:${value}`)
          .join('<br/>')}
      />
    </BaseTooltip>
  )
}
