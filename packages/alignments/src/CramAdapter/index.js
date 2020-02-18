export default ({ jbrequire }) => {
  return {
    configSchema: jbrequire(require('./configSchema')),
    AdapterClass: jbrequire(require('./CramAdapter')),
  }
}
