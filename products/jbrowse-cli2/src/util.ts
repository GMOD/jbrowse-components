import fs from 'fs'
const { readFile, writeFile } = fs.promises

export async function writeJsonFile(location: string, contents: unknown) {
  return writeFile(location, JSON.stringify(contents, null, 2))
}

export async function readJsonFile<T>(location: string): Promise<T> {
  let contents
  try {
    contents = await readFile(location, { encoding: 'utf8' })
  } catch (error) {
    console.error(
      `Make sure the file "${location}" exists or use --out to point to a directory with a config.json`,
      'Run `jbrowse add-assembly` to create a config file',
    )
    throw error
  }
  let result
  try {
    result = JSON.parse(contents)
  } catch (error) {
    console.error(`Make sure "${location}" is a valid JSON file`)
    throw error
  }
  return result
}
