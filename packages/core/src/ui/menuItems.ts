/**
 * Menu-item *builders*, and nothing that draws one.
 *
 * These builders return plain objects, and their callers are state models
 * and `menuItems.ts` / `trackMenus.ts` modules across a dozen plugins — code
 * that is evaluated when a plugin installs, before any session can be read.
 * Reaching them through `@jbrowse/core/ui` meant reaching them through a barrel
 * that re-exports ~80 Material UI components, and the union of what those eager
 * callers happened to name was most of Material UI in every host's first paint
 * (reference/EAGER_BUNDLE.md).
 *
 * So the split is not stylistic: **import menu builders from here, components
 * from `@jbrowse/core/ui`.** This entry must never reach react, @mui or
 * @emotion, and `menuItems.purity.test.ts` fails if it starts to — including
 * transitively, which is the only way the failure would ever show up.
 *
 * The other half of keeping that true is `MenuItemPin`: a row's pin is
 * described here and built by the renderer, because an element in a descriptor
 * pulls its whole component graph back in.
 */
export {
  checkboxItem,
  radioItem,
  radioItems,
  toggleItem,
  withSubHeader,
} from './toggleMenuItems.ts'
export { withHint } from './menuLabels.ts'
export { makeRadioSubMenu } from './radioSubMenu.ts'
export { showLegendCheckboxItem } from './legendMenuItem.ts'
export {
  promotableRadioItem,
  promotableRadioItems,
  promotableToggleItem,
} from './promotableMenuItems.ts'
export type { RadioOption, SettingRowOptions } from './toggleMenuItems.ts'
export { staysOpenOnClick } from './MenuTypes.ts'
export type {
  BaseMenuItem,
  CheckboxMenuItem,
  ClickableMenuItem,
  CustomMenuItem,
  MenuDivider,
  MenuItem,
  MenuItemClickHandler,
  MenuItemPin,
  MenuItemsGetter,
  MenuSubHeader,
  NormalMenuItem,
  RadioMenuItem,
  SubMenuItem,
} from './MenuTypes.ts'
