export interface ConfiguredLegendEntry {
  label: string
  color: string
}

function isConfiguredLegendEntry(e: unknown): e is ConfiguredLegendEntry {
  return (
    typeof e === 'object' &&
    e !== null &&
    'label' in e &&
    typeof e.label === 'string' &&
    'color' in e &&
    typeof e.color === 'string'
  )
}

// The `legend` slot is frozen, so each entry is checked rather than trusted.
export function configuredLegendEntries(
  slot: unknown,
): ConfiguredLegendEntry[] {
  return Array.isArray(slot) ? slot.filter(isConfiguredLegendEntry) : []
}
