import type { FilterStats } from '../VariantRPC/getLDMatrix.ts'

// The per-category filter counts in display order. Both the LD status-bar badge
// and the filter dialog render from this one list, so adding a filter (its
// FilterStats key + label) happens in exactly one place. Type-only import of
// FilterStats keeps this UI-safe: it drags in no RPC/GPU code.
export const LD_FILTER_CATEGORIES: { key: keyof FilterStats; label: string }[] =
  [
    { key: 'filteredByMaf', label: 'MAF' },
    { key: 'filteredByLength', label: 'length' },
    { key: 'filteredByMultiallelic', label: 'multiallelic' },
    { key: 'filteredByHwe', label: 'HWE' },
    { key: 'filteredByCallRate', label: 'call rate' },
    { key: 'filteredByJexl', label: 'jexl' },
  ]
