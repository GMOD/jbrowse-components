import { makeStyles } from '@jbrowse/core/util/tss-react'

import CollapsibleSection from './CollapsibleSection.tsx'
import LinkMenuRow from './LinkMenuRow.tsx'

import type { Fav, LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  tableContainer: {
    overflow: 'auto',
  },
})

function favDisplayName(fav: Pick<Fav, 'shortName' | 'description' | 'commonName'>) {
  return [fav.shortName, fav.description, fav.commonName].filter(Boolean).join(' - ')
}

export default function FavoriteGenomesPanel({
  favorites,
  setFavorites,
  launch,
}: {
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const { classes } = useStyles()

  const sorted = [...favorites]
    .map(fav => ({ ...fav, name: favDisplayName(fav) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <CollapsibleSection storageKey="startScreen-favMinimized" title="Favorite genomes">
      <div className={classes.tableContainer}>
        <table>
          <tbody>
            {sorted.map(({ id, name, shortName, jbrowseConfig, jbrowseMinimalConfig }) => (
              <LinkMenuRow
                key={id}
                label={name}
                onLinkClick={() => {
                  launch([{ shortName, jbrowseConfig }])
                }}
                menuItems={[
                  {
                    label: 'Launch (full config)',
                    onClick: () => {
                      launch([{ shortName, jbrowseConfig }])
                    },
                  },
                  ...(jbrowseMinimalConfig
                    ? [
                        {
                          label: 'Launch (minimal config)',
                          onClick: () => {
                            launch([{ shortName, jbrowseConfig: jbrowseMinimalConfig }])
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
}
