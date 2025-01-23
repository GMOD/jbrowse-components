import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from 'mobx-state-tree'

export type Conf = SnapshotIn<AnyConfigurationModel>

export type ImportFormSyntenyTrack =
  | { type: 'preConfigured'; value: string }
  | { type: 'userOpened'; value: Conf }
  | { type: 'none' }
