import HelpIcon from '@mui/icons-material/Help'
import InfoIcon from '@mui/icons-material/Info'

import type { MenuItem } from '@jbrowse/core/ui'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export function aboutMenuItem(): MenuItem {
  return {
    label: 'About',
    icon: InfoIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('AboutWidget', 'aboutWidget')
    },
  }
}

export function helpMenuItem(): MenuItem {
  return {
    label: 'Help',
    icon: HelpIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('HelpWidget', 'helpWidget')
    },
  }
}
