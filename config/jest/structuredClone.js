global.structuredClone = val => {
  return val === undefined ? undefined : JSON.parse(JSON.stringify(val))
}
