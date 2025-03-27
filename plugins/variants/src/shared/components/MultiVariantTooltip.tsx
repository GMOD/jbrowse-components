import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import escapeHTML from 'escape-html'

export default function MultiVariantTooltip({
  source,
}: {
  source: {
    color?: string
    hoveredGenotype?: { genotype: string; name: string }
    [key: string]: unknown
  }
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
              key !== 'HP' &&
              key !== 'name' &&
              key !== 'id' &&
              val !== undefined,
          )
          .map(([key, value]) => `${key}:${escapeHTML(`${value}`)}`)
          .join('<br/>')}
      />
    </BaseTooltip>
  )
}
