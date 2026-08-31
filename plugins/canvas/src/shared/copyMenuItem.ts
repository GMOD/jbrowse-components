import { copyText } from '@jbrowse/core/util/copyText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// One item that copies `text`, naming what landed in both the menu and the
// confirmation. The node is only what `copyText` reaches the session through, so
// any display with something worth pasting builds its row here rather than
// respelling the icon and the notice beside its own label.
export function copyItem(
  self: IStateTreeNode,
  label: string,
  text: string,
  what: string,
): MenuItem {
  return {
    label,
    icon: ContentCopyIcon,
    onClick: () => {
      void copyText(self, text, what)
    },
  }
}
