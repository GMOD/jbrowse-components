// Adapted from https://github.com/myshenin/aws-lambda-multipart-parser/blob/168aad2e764ac149b86a7b27668a69e81e3a5098/index.js

function getValueIgnoringKeyCase(object, key) {
  const foundKey = Object.keys(object).find(
    currentKey => currentKey.toLocaleLowerCase() === key.toLowerCase(),
  )
  return object[foundKey]
}

function getBoundary(event) {
  return getValueIgnoringKeyCase(event.headers, 'Content-Type').split('=')[1]
}

module.exports.parse = event => {
  const boundary = getBoundary(event)
  const result = {}
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('ascii')
    : event.body
  body.split(boundary).forEach(item => {
    if (/name=".+"/g.test(item)) {
      result[item.match(/name=".+"/g)[0].slice(6, -1)] = item.slice(
        item.search(/name=".+"/g) + item.match(/name=".+"/g)[0].length + 4,
        -4,
      )
    }
  })
  return result
}
