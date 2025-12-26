'use strict'

module.exports = function printBuildError(err) {
  console.log((err?.message) || err)
}
