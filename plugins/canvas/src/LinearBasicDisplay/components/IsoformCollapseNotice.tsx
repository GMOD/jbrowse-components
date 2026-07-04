import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { observer } from 'mobx-react'

import StatusChip from './StatusChip.tsx'

// Self-gating: visible only when collapse is active and not dismissed, so
// callers can render it unconditionally inside BottomRightIndicators.
const IsoformCollapseNotice = observer(function IsoformCollapseNotice({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}) {
  return visible ? (
    <StatusChip
      icon={<UnfoldLessIcon />}
      label="Isoforms collapsed"
      tooltip="Collapsed to the longest coding transcript per gene — dismiss to show all isoforms"
      onDelete={() => {
        onDismiss()
      }}
    />
  ) : null
})

export default IsoformCollapseNotice
