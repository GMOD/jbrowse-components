import PromotableDefaultDialog from './PromotableDefaultDialog.tsx'
import { getSession } from '../util/index.ts'

import type {
  PromotableDisplay,
  PromotableEntry,
} from '../configuration/promotableDefaults.ts'

// Queue the manage-default dialog for a promotable control. Separate from the
// dialog component (so that file only exports a component — fast-refresh) and
// from the core control factory (so configuration never imports a React
// component, which would cycle configuration -> ui).
export function openPromotableDefaultDialog(
  control: { self: PromotableDisplay; entries: PromotableEntry[] },
  valueLabel: string,
): void {
  getSession(control.self).queueDialog(handleClose => [
    PromotableDefaultDialog,
    {
      self: control.self,
      entries: control.entries,
      valueLabel,
      handleClose,
    },
  ])
}
