import pathlib

p = pathlib.Path(
    'plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts'
)
s = p.read_text()

# --- imports -----------------------------------------------------------------
s = s.replace(
    """import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'""",
    """import { stopStopToken } from '@jbrowse/core/util/stopToken'""",
)
s = s.replace("""import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'""",
              """import { flow, types } from '@jbrowse/mobx-state-tree'""")
assert 'createStopTokenRotation' not in s
s = s.replace("""import {
  createStatusWindow,""","""import {
  createStatusWindow,
  createStopTokenRotation,""")

# --- the rotation replaces `activeStatusStream` ------------------------------
s = s.replace(
    """      /**
       * #volatile
       * The in-flight fetch's slot, so a cancel can retire it now rather than
       * whenever the worker gets around to noticing the stop token. `runFetch`
       * retires it again in its `finally`; retiring twice is a no-op.
       */
      activeStatusStream: undefined as StatusStream | undefined,
""",
    "",
)
s = s.replace(
    """      /**
       * #action
       * Drop the active stop token and retire the fetch's status slot. Shared
       * by both cancel paths and runFetch's cleanup.
       *
       * Retiring, not blanking: the field goes blank only if this fetch was the
       * last operation reporting on the display. A **superseded** fetch is the
       * case that made it matter first — the one case where the display does
       * not stop loading, and blanking there flashed the overlay's "Loading"
       * fallback between every pan and the phase the view was already in — but
       * a sources fetch or a clustering run beside it is the same problem
       * without the timing coincidence to hide it (ADR-081).
       */
      resetStatus() {
        self.activeStopToken = undefined
        self.activeStatusStream?.clear()
        self.activeStatusStream = undefined
      },
      /**
       * #action
       * Hold the in-flight fetch's slot so a cancel can reach it. `runFetch`
       * keeps its own reference, so this is only for the paths that end a fetch
       * from outside the flow.
       */
      setActiveStatusStream(stream?: StatusStream) {
        self.activeStatusStream = stream
      },
""",
    "",
)
p.write_text(s)
print('step 1 ok')
