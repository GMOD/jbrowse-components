import { debug, writeJsonFile } from '../../utils.ts'

import type { Config } from '../../base.ts'

function findAndUpdateOrAdd<I extends string, T extends Record<I, string>>({
  items,
  newItem,
  idField,
  force,
  itemType,
}: {
  items: T[]
  newItem: T
  idField: I
  force: boolean
  itemType: string
}) {
  const newId = newItem[idField]
  const idx = items.findIndex(item => item[idField] === newId)

  if (idx !== -1) {
    debug(`Found existing ${itemType} ${newId} in configuration`)
    if (force) {
      debug(`Overwriting ${itemType} ${newId} in configuration`)
      const updatedItems = [...items]
      updatedItems[idx] = newItem
      return { updatedItems, wasOverwritten: true }
    } else {
      throw new Error(
        `Cannot add ${itemType} with ${idField} ${newId}, a ${itemType} with that ${idField} already exists`,
      )
    }
  } else {
    return { updatedItems: [...items, newItem], wasOverwritten: false }
  }
}

// adds `entry` to the config's `collection` (or replaces the one with its id
// under force), runs `beforeSave` once a duplicate can no longer throw, then
// writes the config and says what happened
export async function upsertConfigEntry<
  I extends string,
  T extends Record<I, string>,
>({
  config,
  target,
  collection,
  items,
  entry,
  idField,
  itemType,
  itemName,
  force = false,
  beforeSave,
}: {
  config: Config
  target: string
  collection: 'tracks' | 'connections' | 'assemblies'
  items: T[]
  entry: T
  idField: I
  itemType: string
  itemName: string
  force?: boolean
  beforeSave?: () => Promise<void>
}) {
  const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
    items,
    newItem: entry,
    idField,
    force,
    itemType,
  })
  await beforeSave?.()

  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, { ...config, [collection]: updatedItems })

  console.log(
    `${wasOverwritten ? 'Overwrote' : 'Added'} ${itemType} with name "${itemName}" and ${itemType}Id "${entry[idField]}" ${
      wasOverwritten ? 'in' : 'to'
    } ${target}`,
  )
}
