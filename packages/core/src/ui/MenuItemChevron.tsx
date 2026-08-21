import ChevronRight from '@mui/icons-material/ChevronRight'

// The chevron a submenu row ends in, and — `hidden` — an invisible copy
// reserving the identical footprint on a clickable row that has none, so a menu
// carrying help on both kinds lands every "?" in one column.
//
// ONE COMPONENT, because "identical footprint" is the whole contract and two
// bodies can drift: a `fontSize` added to one and not the other reintroduces
// exactly the misalignment this exists to remove.
//
// A COPY, not a width. The column was a hard-coded 24, the px an MUI
// `fontSize="medium"` icon is at MUI's own defaults. This theme sets
// `typography.fontSize: 12`, which scales `pxToRem` by 12/14, so the chevron
// actually draws at ~20.6px and every clickable row's "?" sat ~3.4px inboard of
// the submenu rows'. Rendering the icon itself cannot be off by a scale factor
// nothing here gets to see.
export function MenuItemChevron({ hidden }: { hidden?: boolean }) {
  return <ChevronRight style={hidden ? { visibility: 'hidden' } : undefined} />
}
