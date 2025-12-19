import { measureGridWidth } from '@jbrowse/core/util'

export function computeInitialWidths(
  rows: { name: string; metadata: Record<string, unknown> }[],
  filteredNonMetadataKeys: readonly string[],
  filteredMetadataKeys: string[],
  visible: Record<string, boolean>,
) {
  return {
    name:
      measureGridWidth(
        rows.map(r => r.name),
        { maxWidth: 500, stripHTML: true },
      ) + 15,
    ...Object.fromEntries(
      filteredNonMetadataKeys
        .filter(f => visible[f])
        .map(e => [
          e,
          measureGridWidth(
            rows.map(r => r[e as keyof typeof r] as string),
            { maxWidth: 400, stripHTML: true },
          ),
        ]),
    ),
    ...Object.fromEntries(
      filteredMetadataKeys
        .filter(f => visible[`metadata.${f}`])
        .map(e => [
          `metadata.${e}`,
          measureGridWidth(
            rows.map(r => r.metadata[e]),
            { maxWidth: 400, stripHTML: true },
          ),
        ]),
    ),
  }
}
