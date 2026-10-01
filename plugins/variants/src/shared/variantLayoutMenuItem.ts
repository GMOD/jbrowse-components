import { toggleItem } from '@jbrowse/core/ui/menuItems'

export type VariantLayout = 'genomic' | 'columns'

export function variantLayoutMenuItem(self: {
  variantLayout: VariantLayout
  setVariantLayout: (arg: VariantLayout) => void
}) {
  return toggleItem(
    'One column per variant',
    self.variantLayout === 'columns',
    on => {
      self.setVariantLayout(on ? 'columns' : 'genomic')
    },
    {
      helpText:
        'Draw each variant in view as one equal-width column, so variants a few bases apart stay readable at any zoom. Off, each variant sits at its genomic position.',
    },
  )
}
