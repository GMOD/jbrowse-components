import React from 'react'
import mstModel from './appBarModel'
import AppBar from './AppBar'

// export default class AppBarPlugin {
//   install(browser) {
//     this.installed = true
//     browser.addViewType('linear', { mstModel, ReactComponent })
//   }
// }

const store = mstModel.create({
  menus: [
    {
      name: 'FirstMenu',
      menuItems: [
        {
          name: 'FirstMenuItem',
          // callback: `
          // async function(that) {
          //   const { default: AboutModal } = await import('./AboutModal')
          //   console.log(aboutModal)
          // }`,
        },
      ],
    },
  ],
})

export default <AppBar store={store} />
