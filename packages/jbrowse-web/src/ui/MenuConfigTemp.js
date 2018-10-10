export default [
  {
    menuTitle: 'Genome',
    menuItems: [
      'Open sequence file',
      'Volvox Example',
      'MODEncode Example',
      'Yeast Example',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Open sequence file"'),
      () => console.log('clicked menu item "Volvox Example"'),
      () => console.log('clicked menu item "MODEncode Example"'),
      () => console.log('clicked menu item "Yeast Example"'),
    ],
    itemIcons: ['folder_open', 'bookmark', 'bookmark', 'bookmark'],
  },
  {
    menuTitle: 'Track',
    menuItems: [
      'Open track file or URL',
      'Add combination track',
      'Add sequence search track',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Open track file or URL"'),
      () => console.log('clicked menu item "Add combination track"'),
      () => console.log('clicked menu item "Add sequence search track"'),
    ],
    itemIcons: ['folder_open', 'playlist_add', 'find_in_page'],
  },
  {
    menuTitle: 'View',
    menuItems: [
      'Set highlight',
      'Clear highlight',
      'Resize quant. tracks',
      'Search features',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Set highlight"'),
      () => console.log('clicked menu item "Clear highlight"'),
      () => console.log('clicked menu item "Resize quant. tracks"'),
      () => console.log('clicked menu item "Search features"'),
    ],
    itemIcons: ['highlight', 'highlight', 'photo_size_select_small', 'search'],
  },
  {
    menuTitle: 'Help',
    menuItems: ['About', 'General'],
    itemCallbacks: [
      () => console.log('clicked menu item "About"'),
      () => console.log('clicked menu item "General"'),
    ],
    itemIcons: ['info', 'help'],
  },
]
