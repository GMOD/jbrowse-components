module.exports = function (context, options) {
  // ...
  return {
    name: 'webpack-addons',
    async loadContent() {
      console.log('test')
    },
    async contentLoaded({ content, actions }) {
      console.log('contentLoaded')
    },
    /* other lifecycle API */
  }
}
