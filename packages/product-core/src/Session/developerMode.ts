import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  enableContractReports,
  setContractReportSink,
} from '@jbrowse/render-core/contractReports'

import type { NotificationSink } from '@jbrowse/core/util/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ContractReport } from '@jbrowse/render-core/contractReports'

interface DeveloperModeHost
  extends IStateTreeNode, Pick<NotificationSink, 'notify'> {
  getPreference: (key: string) => unknown
}

/**
 * What a plugin author sees when their display breaks an ordering contract in
 * somebody else's production build.
 *
 * The checks themselves have always run and always reported; what they had no
 * way to reach was this population, which is the one least able to diagnose the
 * symptom and the one nobody can write a test for. A `console.error` surviving
 * the build would not have fixed that — nobody has a console open on a page
 * they did not write — so the report has to land in the app, in the session the
 * broken display is in, and it has to explain itself: the reader did not turn
 * this on deliberately in the common case (a plugin served from their own
 * machine did), and a message they cannot place reads as the app being broken.
 *
 * `warning` rather than `error`: an error snackbar in this app means the user's
 * data or their request failed, and every word here is about code they are
 * writing. Warnings persist until dismissed, which is what a message with a fix
 * in it wants, and identical ones collapse in the snackbar — so a violation
 * repeating across ten tracks of one broken type is still one notice.
 */
function notification({ family, message, armedBy }: ContractReport) {
  return (
    `JBrowse ${family} contract broken — a bug in code, not in your data or ` +
    `configuration.\n\n${message}\n\n` +
    `Shown because ${armedBy}. These notices can be turned on anywhere with ` +
    `localStorage.jbrowseDeveloperMode = 1, or site-wide with ` +
    `configuration.preferences.developerMode.`
  )
}

export function applyDeveloperMode(self: DeveloperModeHost) {
  if (self.getPreference('developerMode') === true) {
    enableContractReports(
      'this site sets configuration.preferences.developerMode',
    )
  }
  addDisposer(
    self,
    setContractReportSink(report => {
      // out of whatever reaction, fetch handler or upload found the violation:
      // `notify` writes observables, and a diagnostic that throws where it is
      // read is worse than the bug it describes
      queueMicrotask(() => {
        if (isAlive(self)) {
          self.notify(notification(report), 'warning')
        }
      })
    }),
  )
}
