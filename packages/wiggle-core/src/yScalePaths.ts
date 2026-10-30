export type YMember =
  | 'type'
  | 'zero'
  | 'domainMin'
  | 'domainMax'
  | 'fence'
  | 'constant'
  | 'group'
  | 'title'
  | 'show'
  | 'grid'
  | 'rules'

/**
 * Where each member of a display's y scale lives in its config. `reset` lists
 * the sub-objects a reset rewrites: resetting a whole `encoding.y` would also
 * revert a plotted field that lives beside the scale.
 */
export interface YScalePaths {
  members: Record<YMember, readonly string[]>
  reset: readonly (readonly string[])[]
}
