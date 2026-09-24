import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { lazyChunk } from './lazyChunk.ts'

export const DrawerWidget = lazyWithPreload(
  lazyChunk('DrawerWidget', () => import('./DrawerWidget.tsx')),
)

export const ClassicViewsContainer = lazyWithPreload(
  lazyChunk(
    'ClassicViewsContainer',
    () => import('./ClassicViewsContainer.tsx'),
  ),
)

export const WorkspaceContainer = lazyWithPreload(
  lazyChunk('WorkspaceContainer', () =>
    import('../../WorkspaceLayout/WorkspaceContainer.tsx').then(m => ({
      default: m.WorkspaceContainer,
    })),
  ),
)

export const ViewLauncher = lazyWithPreload(
  lazyChunk('ViewLauncher', () => import('./ViewLauncher.tsx')),
)
