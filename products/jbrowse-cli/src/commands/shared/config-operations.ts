import { debug, writeJsonFile } from '../../utils'

import type { Config } from '../../base'

/**
 * Generic function to find and update or add an item to a config array
 * Returns the updated config and whether an item was overwritten
 */
export function findAndUpdateOrAdd<T extends { [key: string]: any }>({
  items,
  newItem,
  idField,
  getId,
  allowOverwrite,
  itemType,
}: {
  items: T[]
  newItem: T
  idField: string
  getId: (item: T) => string
  allowOverwrite: boolean
  itemType: string
}): { updatedItems: T[]; wasOverwritten: boolean } {
  const newId = getId(newItem)
  const idx = items.findIndex(item => getId(item) === newId)

  if (idx !== -1) {
    debug(`Found existing ${itemType} ${newId} in configuration`)
    if (allowOverwrite) {
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

/**
 * Saves a config file and reports the result to the user
 */
export async function saveConfigAndReport({
  config,
  target,
  itemType,
  itemName,
  itemId,
  wasOverwritten,
}: {
  config: Config
  target: string
  itemType: string
  itemName: string
  itemId?: string
  wasOverwritten: boolean
}): Promise<void> {
  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, config)

  const idPart = itemId ? ` and ${itemType}Id "${itemId}"` : ''
  console.log(
    `${wasOverwritten ? 'Overwrote' : 'Added'} ${itemType} with name "${itemName}"${idPart} ${
      wasOverwritten ? 'in' : 'to'
    } ${target}`,
  )
}
