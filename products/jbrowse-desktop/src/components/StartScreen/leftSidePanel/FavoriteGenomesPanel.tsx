import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import defaultFavs from '../defaultFavs.ts'
import CollapsibleSection from './CollapsibleSection.tsx'
import LinkMenuRow from './LinkMenuRow.tsx'

import type { Fav, LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  tableContainer: {
    overflow: 'auto',
  },
})

const defaultFavIds = defaultFavs.map(fav => fav.id)

function favDisplayName({
  shortName,
  description,
  commonName,
}: Pick<Fav, 'shortName' | 'description' | 'commonName'>) {
  const assembly = (/\(([^)]*)\)/.exec(description)?.[1] ?? '')
    .split('/')
    .filter(part => part && part !== shortName)
    .join('/')
  const name = [commonName, shortName].filter(Boolean).join(' ')
  return assembly ? `${name} (${assembly})` : name
}

function defaultRank(id: string) {
  const rank = defaultFavIds.indexOf(id)
  return rank === -1 ? defaultFavIds.length : rank
}

const FavoriteGenomesPanel = observer(function FavoriteGenomesPanel({
  favorites,
  setFavorites,
  launch,
}: {
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const { classes } = useStyles()

  const sorted = favorites
    .map(fav => ({ ...fav, name: favDisplayName(fav) }))
    .toSorted((a, b) => defaultRank(a.id) - defaultRank(b.id))

  return (
    <CollapsibleSection
      storageKey="startScreen-favMinimized"
      title="Favorite genomes"
    >
      <div className={classes.tableContainer}>
        <table>
          <tbody>
            {sorted.map(({ id, name, jbrowseConfig, jbrowseMinimalConfig }) => (
              <LinkMenuRow
                key={id}
                label={name}
                onLinkClick={() => {
                  launch([jbrowseConfig])
                }}
                menuItems={[
                  ...(jbrowseMinimalConfig
                    ? [
                        {
                          label: 'Launch (minimal config)',
                          onClick: () => {
                            launch([jbrowseMinimalConfig])
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'Remove from favorites',
                    onClick: () => {
                      setFavorites(favorites.filter(fav => fav.id !== id))
                    },
                  },
                ]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
})

export default FavoriteGenomesPanel
