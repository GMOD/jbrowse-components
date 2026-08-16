import { lazy } from 'react'

/**
 * Every dialog this plugin's state models name, behind its own chunk.
 *
 * `LDDisplay/shared.ts` and `multiSampleVariantMenuItems.ts` are both reached
 * from state models: they are evaluated when the plugin installs, before any
 * session is read, so importing a dialog there put the dialog — and MUI's
 * `TextField` → `Select` → `Modal` → `Popover` cluster behind it — into every
 * host's first paint, whether or not anything ever opened the menu. See
 * `agent-docs/reference/EAGER_BUNDLE.md`.
 *
 * Nothing else is needed to make this work: `session.queueDialog` hands the
 * component to `DialogQueue`, which already renders it inside a `Suspense`
 * boundary. Same arrangement as `plugin-linear-genome-view`'s `lazyDialogs.ts`.
 *
 * One module rather than a `lazy()` beside each menu, because the jexl filter
 * dialog is opened from both the LD menu and the multi-sample one: wrapping the
 * same import twice mints two distinct lazy component types for one chunk, so
 * the two menus suspend against separate boundaries and neither warms the other.
 */
export const JexlFilterDialog = lazy(
  () => import('@jbrowse/core/ui/JexlFilterDialog'),
)
export const LDFilterDialog = lazy(
  () => import('./components/LDFilterDialog.tsx'),
)
export const SetColorDialog = lazy(
  () => import('./components/SetColorDialog.tsx'),
)
export const MultiSampleVariantClusterDialog = lazy(
  () => import('./components/MultiSampleVariantClusterDialog.tsx'),
)
