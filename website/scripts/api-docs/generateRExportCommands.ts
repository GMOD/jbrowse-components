import { rExportInvocation } from '../rexportCommand.ts'
import { rExportCommandBlock } from '../rexportCommandText.ts'
import { rexportSpecs } from '../specs/rexport.ts'
import { rewriteMarkerBlock } from './util.ts'

// Publish, per gallery figure, the exact `jb2export` command that produced it.
//
// The gallery's claim is that every figure is unretouched output of the real
// exporter, and the only way a reader can check that claim is to run the same
// command. A hand-written list would go stale the first time a figure was
// retargeted — silently, because a wrong command still runs and still draws
// something. So both sides read one function: the sweep calls
// `rExportInvocation(spec)` to make the figure, and this renders the same call
// as shell.
//
// The page opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- REXPORT_COMMANDS START -->
//   <!-- REXPORT_COMMANDS END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

export function renderRExportCommands() {
  return rexportSpecs
    .map(spec =>
      rExportCommandBlock(
        spec.name.slice(spec.name.lastIndexOf('/') + 1),
        rExportInvocation(spec),
      ),
    )
    .join('\n\n')
}

export function writeRExportCommandDocs({ check = false } = {}) {
  return rewriteMarkerBlock('REXPORT_COMMANDS', renderRExportCommands(), {
    check,
  })
}
