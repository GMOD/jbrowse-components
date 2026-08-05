import { lazy } from 'react'

/**
 * The LD display's two filter dialogs, behind their own chunks.
 *
 * `LDDisplay/shared.ts` is a state model: it is evaluated when the plugin
 * installs, before any session is read, so importing a dialog there put the
 * dialog — and MUI's `TextField` → `Select` → `Modal` → `Popover` cluster behind
 * it — into every host's first paint, whether or not anything ever opened the
 * "Filter by..." menu. See `agent-docs/reference/EAGER_BUNDLE.md`.
 *
 * Nothing else is needed to make this work: `session.queueDialog` hands the
 * component to `DialogQueue`, which already renders it inside a `Suspense`
 * boundary. Same arrangement as `plugin-linear-genome-view`'s `lazyDialogs.ts`.
 */
export const AddFiltersDialog = lazy(
  () => import('./components/AddFiltersDialog.tsx'),
)
export const LDFilterDialog = lazy(
  () => import('./components/LDFilterDialog.tsx'),
)
