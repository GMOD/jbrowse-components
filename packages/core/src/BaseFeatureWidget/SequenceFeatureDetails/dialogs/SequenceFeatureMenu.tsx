import MoreVert from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import CascadingMenuButton from '../../../ui/CascadingMenuButton.tsx'
import { copyTextWithSession } from '../../../util/copyText.ts'
import { saveAs } from '../../../util/index.ts'
import { getSequenceFasta } from '../util.ts'
import { sequenceSettingsMenuItems } from './sequenceSettingsMenu.ts'

import type { MenuItem } from '../../../ui/index.ts'
import type { AbstractSessionModel } from '../../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'
import type { RefObject } from 'react'

interface Props {
  model: SequenceFeatureDetailsModel
  // the settings model is a bare preferences model that a standalone dialog
  // creates detached, so the menu cannot reach a session by walking up from it.
  // whoever mounted the panel supplies one.
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>
  ref: RefObject<HTMLElement | null>
  fileStem: string
  mode: SequenceDisplayMode
  revcomp: boolean
  setRevcomp: (arg: boolean) => void
  extraItems?: MenuItem[]
}
const SequenceFeatureMenu = observer(function SequenceFeatureMenu({
  model,
  session,
  ref,
  fileStem,
  mode,
  revcomp,
  setRevcomp,
  extraItems = [],
}: Props) {
  // every export row reads the rendered panel out of the ref, which is empty
  // until the panel mounts (the sequence is still loading, or errored)
  const withPanel =
    (f: (panel: HTMLElement) => Promise<void> | void) => async () => {
      const panel = ref.current
      if (panel) {
        await f(panel)
      }
    }

  return (
    <CascadingMenuButton
      tooltip="Sequence options"
      menuItems={[
        {
          label: 'Copy FASTA',
          onClick: withPanel(panel =>
            copyTextWithSession(session, getSequenceFasta(panel), 'sequence'),
          ),
        },
        {
          label: 'Copy HTML',
          onClick: withPanel(panel =>
            copyTextWithSession(session, panel.outerHTML, 'sequence HTML', {
              format: 'text/html',
            }),
          ),
        },
        {
          label: 'Download FASTA',
          onClick: withPanel(panel => {
            saveAs(
              new Blob([getSequenceFasta(panel)], {
                type: 'text/plain;charset=utf-8',
              }),
              `${fileStem}.fa`,
            )
          }),
        },
        {
          label: 'Download HTML',
          onClick: withPanel(panel => {
            saveAs(
              new Blob([panel.outerHTML], {
                type: 'text/html;charset=utf-8',
              }),
              `${fileStem}.html`,
            )
          }),
        },
        ...extraItems,
        ...sequenceSettingsMenuItems({ model, mode, revcomp, setRevcomp }),
      ]}
    >
      <MoreVert />
    </CascadingMenuButton>
  )
})

export default SequenceFeatureMenu
