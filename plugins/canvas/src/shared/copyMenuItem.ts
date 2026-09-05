import { copyText } from '@jbrowse/core/util/copyText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
