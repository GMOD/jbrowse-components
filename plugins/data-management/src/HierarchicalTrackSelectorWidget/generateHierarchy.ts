import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { isSessionWithSessionTracks } from '@jbrowse/product-core'

import { sortConfs } from './sortUtils.ts'
import { matchesLower } from './util.ts'

import type { MinimalModel, TreeNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface NodeWithChildren {
  children: TreeNode[]
}

export function generateHierarchy({
  model,
  trackConfs,
  extra,
  noCategories,
}: {
  model: MinimalModel
  noCategories?: boolean
  trackConfs: AnyConfigurationModel[]
  extra?: string
}): TreeNode[] {
  const root: NodeWithChildren = { children: [] }
  const { filterText, activeSortTrackNames, activeSortCategories } = model
  const session = getSession(model)

  // a non-admin's added/copied tracks live in session.sessionTracks and are
  // grouped under a "Session tracks" category. Membership is the session's own
  // list — the source of truth — not a suffix baked into the trackId.
  const sessionTrackIds = new Set(
    isSessionWithSessionTracks(session)
      ? session.sessionTracks.map(t => t.trackId)
      : [],
  )

  const queryLower = filterText.trim().toLowerCase()
  const confs = queryLower
    ? trackConfs.filter(conf => matchesLower(queryLower, conf, session))
    : trackConfs

  const categoryMaps = new Map<NodeWithChildren, Map<string, TreeNode>>()

  for (const conf of sortConfs(
    confs,
    activeSortTrackNames,
    activeSortCategories,
  )) {
    const isSessionTrack = sessionTrackIds.has(conf.trackId)
    const baseCategories =
      (readConfObject(conf, 'category') as string[] | undefined) ?? []
    const categories = isSessionTrack
      ? [' Session tracks', ...baseCategories]
      : baseCategories

    let currLevel: NodeWithChildren = root
    let nestingLevel = 0

    if (!noCategories) {
      let categoryPath = ''
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]!
        categoryPath = categoryPath ? `${categoryPath},${category}` : category

        let categoryMap = categoryMaps.get(currLevel)
        if (!categoryMap) {
          categoryMap = new Map()
          categoryMaps.set(currLevel, categoryMap)
        }

        let existing = categoryMap.get(category)
        if (!existing) {
          const id = extra ? `${extra}-${categoryPath}` : categoryPath
          existing = {
            children: [],
            name: category,
            id,
            nestingLevel: i + 1,
            type: 'category' as const,
          }
          currLevel.children.push(existing)
          categoryMap.set(category, existing)
        }
        currLevel = existing
        nestingLevel = i + 1
      }
    }

    // push order is fine — sortedChildren() in flattenedItems re-groups
    // tracks before categories during virtual-scroll flattening
    currLevel.children.push({
      id: extra ? `${extra},${conf.trackId}` : conf.trackId,
      trackId: conf.trackId,
      name: getTrackName(conf, session),
      description:
        (readConfObject(conf, 'description') as string | undefined) ?? '',
      conf,
      children: [],
      nestingLevel: nestingLevel + 1,
      type: 'track' as const,
    })
  }

  return root.children
}
