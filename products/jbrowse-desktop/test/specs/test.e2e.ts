import * as path from 'path'
import { fileURLToPath } from 'url'

declare const browser: WebdriverIO.Browser
declare const $: WebdriverIO.Browser['$']
declare const $$: WebdriverIO.Browser['$$']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_DATA_DIR = path.resolve(__dirname, '../../../../test_data/volvox')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function findByText(text: string, timeout = 30000) {
  const element = await $(`*=${text}`)
  await element.waitForDisplayed({ timeout })
  return element
}

async function findByTestId(testId: string, timeout = 30000) {
  const element = await $(`[data-testid="${testId}"]`)
  await element.waitForDisplayed({ timeout })
  return element
}

async function waitForStartScreen(timeout = 30000) {
  await findByText('Launch new session', timeout)
}

async function clickButton(text: string, timeout = 10000) {
  const button = await findByText(text, timeout)
  await button.click()
}

async function waitForLinearGenomeView(timeout = 60000) {
  const locstring = await $('input[placeholder="Search for location"]')
  await locstring.waitForDisplayed({ timeout })
}

describe('JBrowse Desktop - Start Screen', () => {
  it('should display application title', async () => {
    const title = await browser.getTitle()
    expect(title).toEqual('JBrowse')
  })

  it('should display start screen with launch options', async () => {
    await waitForStartScreen()
    const launchText = await findByText('Launch new session')
    expect(await launchText.isDisplayed()).toBe(true)
  })

  it('should show "Open new genome" button', async () => {
    await waitForStartScreen()
    const openGenomeBtn = await findByText('Open new genome')
    expect(await openGenomeBtn.isDisplayed()).toBe(true)
  })

  it('should show "Show all available genomes" button', async () => {
    await waitForStartScreen()
    const availableGenomesBtn = await findByText('Show all available genomes')
    expect(await availableGenomesBtn.isDisplayed()).toBe(true)
  })

  it('should show recently opened sessions section', async () => {
    await waitForStartScreen()
    const recentSection = await findByText('Recently opened sessions')
    expect(await recentSection.isDisplayed()).toBe(true)
  })
})

describe('JBrowse Desktop - Open Genome Dialog', () => {
  beforeEach(async () => {
    await browser.reloadSession()
    await waitForStartScreen()
  })

  it('should open the genome dialog when clicking "Open new genome"', async () => {
    await clickButton('Open new genome')
    await delay(500)
    const dialogTitle = await findByText('Open genome(s)')
    expect(await dialogTitle.isDisplayed()).toBe(true)
  })

  it('should show adapter type selector with IndexedFastaAdapter as default', async () => {
    await clickButton('Open new genome')
    await delay(500)
    const adapterSelector = await findByText('IndexedFastaAdapter')
    expect(await adapterSelector.isDisplayed()).toBe(true)
  })

  it('should show file selector components', async () => {
    await clickButton('Open new genome')
    await delay(500)
    const fastaLabel = await findByText('FASTA file')
    expect(await fastaLabel.isDisplayed()).toBe(true)
  })

  it('should be able to cancel genome dialog', async () => {
    await clickButton('Open new genome')
    await delay(500)
    await clickButton('Cancel')
    await delay(500)
    await waitForStartScreen()
  })

  it('should show error when submitting without assembly name', async () => {
    await clickButton('Open new genome')
    await delay(500)
    await clickButton('Submit')
    await delay(500)
    const errorText = await findByText('No assembly name set', 5000).catch(
      () => null,
    )
    expect(errorText).not.toBeNull()
  })
})

describe('JBrowse Desktop - Available Genomes', () => {
  beforeEach(async () => {
    await browser.reloadSession()
    await waitForStartScreen()
  })

  it('should open available genomes dialog', async () => {
    await clickButton('Show all available genomes')
    await delay(500)
    const dialogTitle = await findByText('Available genomes')
    expect(await dialogTitle.isDisplayed()).toBe(true)
  })

  it('should be able to close available genomes dialog', async () => {
    await clickButton('Show all available genomes')
    await delay(500)
    // Press Escape to close the dialog
    await browser.keys('Escape')
    await delay(500)
    await waitForStartScreen()
  })
})

describe('JBrowse Desktop - Open Genome with Files', () => {
  const FASTA_PATH = path.join(TEST_DATA_DIR, 'volvox.fa')
  const FAI_PATH = path.join(TEST_DATA_DIR, 'volvox.fa.fai')

  beforeEach(async () => {
    await browser.reloadSession()
    await waitForStartScreen()
  })

  it('should open indexed FASTA from local file paths', async () => {
    await clickButton('Open new genome')
    await delay(500)

    // Find and fill assembly name input
    const assemblyNameInput = await $(
      'input[placeholder=""], input:not([type="file"])',
    )
    // The first input should be the assembly name
    const allInputs = await $$('input:not([type="file"]):not([type="hidden"])')
    for (const input of allInputs) {
      const isVisible = await input.isDisplayed()
      if (isVisible) {
        await input.setValue('volvox')
        break
      }
    }

    // Switch to URL mode for file selectors and enter file:// URLs
    const urlToggleButtons = await $$('button[value="url"]')
    const urlInputs: WebdriverIO.Element[] = []

    // Click first URL toggle and get its input
    if (urlToggleButtons.length >= 1) {
      await urlToggleButtons[0].click()
      await delay(300)
      const firstUrlInput = await $('input[placeholder="Enter URL"]')
      await firstUrlInput.setValue(`file://${FASTA_PATH}`)
    }

    // Click second URL toggle and get its input
    if (urlToggleButtons.length >= 2) {
      await urlToggleButtons[1].click()
      await delay(300)
      const allUrlInputs = await $$('input[placeholder="Enter URL"]')
      if (allUrlInputs.length >= 2) {
        await allUrlInputs[1].setValue(`file://${FAI_PATH}`)
      }
    }

    // Submit the form
    await clickButton('Submit')

    // Wait for the linear genome view to load
    await waitForLinearGenomeView(90000)

    // Verify we can see the reference sequence name
    const refSeqName = await findByText('ctgA', 30000).catch(() => null)
    expect(refSeqName).not.toBeNull()
  })
})

describe('JBrowse Desktop - Track Operations', () => {
  const FASTA_PATH = path.join(TEST_DATA_DIR, 'volvox.fa')
  const FAI_PATH = path.join(TEST_DATA_DIR, 'volvox.fa.fai')
  const BAM_PATH = path.join(TEST_DATA_DIR, 'volvox-sorted.bam')
  const BAI_PATH = path.join(TEST_DATA_DIR, 'volvox-sorted.bam.bai')

  async function openVolvoxGenome() {
    await clickButton('Open new genome')
    await delay(500)

    const allInputs = await $$('input:not([type="file"]):not([type="hidden"])')
    for (const input of allInputs) {
      const isVisible = await input.isDisplayed()
      if (isVisible) {
        await input.setValue('volvox')
        break
      }
    }

    const urlToggleButtons = await $$('button[value="url"]')
    if (urlToggleButtons.length >= 1) {
      await urlToggleButtons[0].click()
      await delay(300)
      const firstUrlInput = await $('input[placeholder="Enter URL"]')
      await firstUrlInput.setValue(`file://${FASTA_PATH}`)
    }
    if (urlToggleButtons.length >= 2) {
      await urlToggleButtons[1].click()
      await delay(300)
      const allUrlInputs = await $$('input[placeholder="Enter URL"]')
      if (allUrlInputs.length >= 2) {
        await allUrlInputs[1].setValue(`file://${FAI_PATH}`)
      }
    }

    await clickButton('Submit')
    await waitForLinearGenomeView(90000)
  }

  beforeEach(async () => {
    await browser.reloadSession()
    await waitForStartScreen()
  })

  it('should be able to access File menu after opening genome', async () => {
    await openVolvoxGenome()
    const fileMenu = await findByText('File', 10000)
    expect(await fileMenu.isDisplayed()).toBe(true)
  })

  it('should be able to access Help menu and About dialog', async () => {
    await openVolvoxGenome()
    await clickButton('Help')
    await delay(300)
    await clickButton('About')
    await delay(500)
    const aboutText = await findByText('The Evolutionary Software Foundation', 10000).catch(() => null)
    expect(aboutText).not.toBeNull()
  })

  it('should be able to zoom in and out', async () => {
    await openVolvoxGenome()

    const zoomIn = await findByTestId('zoom_in', 10000)
    await zoomIn.click()
    await delay(500)

    const zoomOut = await findByTestId('zoom_out', 10000)
    await zoomOut.click()
    await delay(500)
  })

  it('should be able to search for a location', async () => {
    await openVolvoxGenome()

    const searchInput = await $('input[placeholder="Search for location"]')
    await searchInput.click()
    await searchInput.setValue('ctgA:1000..2000')
    await browser.keys('Enter')
    await delay(1000)
  })
})

describe('JBrowse Desktop - Workspaces', () => {
  const FASTA_PATH = path.join(TEST_DATA_DIR, 'volvox.fa')
  const FAI_PATH = path.join(TEST_DATA_DIR, 'volvox.fa.fai')

  async function openVolvoxGenome() {
    await clickButton('Open new genome')
    await delay(500)

    const allInputs = await $$('input:not([type="file"]):not([type="hidden"])')
    for (const input of allInputs) {
      const isVisible = await input.isDisplayed()
      if (isVisible) {
        await input.setValue('volvox')
        break
      }
    }

    const urlToggleButtons = await $$('button[value="url"]')
    if (urlToggleButtons.length >= 1) {
      await urlToggleButtons[0].click()
      await delay(300)
      const firstUrlInput = await $('input[placeholder="Enter URL"]')
      await firstUrlInput.setValue(`file://${FASTA_PATH}`)
    }
    if (urlToggleButtons.length >= 2) {
      await urlToggleButtons[1].click()
      await delay(300)
      const allUrlInputs = await $$('input[placeholder="Enter URL"]')
      if (allUrlInputs.length >= 2) {
        await allUrlInputs[1].setValue(`file://${FAI_PATH}`)
      }
    }

    await clickButton('Submit')
    await waitForLinearGenomeView(90000)
  }

  async function openViewMenu() {
    const viewMenu = await findByTestId('view_menu_icon', 10000)
    await viewMenu.click()
    await delay(300)
  }

  async function clickViewOptions() {
    const viewOptions = await findByText('View options', 10000)
    await viewOptions.click()
    await delay(300)
  }

  beforeEach(async () => {
    await browser.reloadSession()
    await waitForStartScreen()
  })

  it('should enable workspaces when moving view to new tab', async () => {
    await openVolvoxGenome()

    // Open view menu
    await openViewMenu()

    // Click View options
    await clickViewOptions()

    // Click Move to new tab
    const moveToTab = await findByText('Move to new tab', 10000)
    await moveToTab.click()

    // Wait for workspaces to be enabled (dockview tabs should appear)
    await delay(1000)

    // Verify dockview is present
    const dockview = await $(
      '.dockview-theme-light, .dockview-theme-dark',
    ).catch(() => null)
    expect(dockview).not.toBeNull()
  })

  it('should enable workspaces when moving view to split view', async () => {
    await openVolvoxGenome()

    // Open view menu
    await openViewMenu()

    // Click View options
    await clickViewOptions()

    // Click Move to split view
    const moveToSplit = await findByText('Move to split view', 10000)
    await moveToSplit.click()

    // Wait for workspaces to be enabled
    await delay(1000)

    // Verify dockview is present
    const dockview = await $(
      '.dockview-theme-light, .dockview-theme-dark',
    ).catch(() => null)
    expect(dockview).not.toBeNull()
  })

  it('should create second view when copying view', async () => {
    await openVolvoxGenome()

    // Open view menu
    await openViewMenu()

    // Click View options
    await clickViewOptions()

    // Click Copy view
    const copyView = await findByText('Copy view', 10000)
    await copyView.click()
    await delay(1000)

    // Should now have 2 view menus
    const viewMenus = await $$('[data-testid="view_menu_icon"]')
    expect(viewMenus.length).toBe(2)
  })

  it('should allow moving views up and down in workspace', async () => {
    await openVolvoxGenome()

    // First copy the view to get 2 views
    await openViewMenu()
    await clickViewOptions()
    const copyView = await findByText('Copy view', 10000)
    await copyView.click()
    await delay(1000)

    // Enable workspaces by moving to new tab
    const viewMenus = await $$('[data-testid="view_menu_icon"]')
    await viewMenus[0].click()
    await delay(300)
    await clickViewOptions()
    const moveToTab = await findByText('Move to new tab', 10000)
    await moveToTab.click()
    await delay(1000)

    // Wait for dockview
    await $('.dockview-theme-light, .dockview-theme-dark')

    // Copy view again to have multiple views in one panel
    const viewMenuAfter = await findByTestId('view_menu_icon', 10000)
    await viewMenuAfter.click()
    await delay(300)
    await clickViewOptions()
    const copyView2 = await findByText('Copy view', 10000)
    await copyView2.click()
    await delay(1000)

    // Get the order of view containers before moving
    const getViewOrder = async () => {
      return browser.execute(() => {
        const containers = document.querySelectorAll(
          '[data-testid^="view-container-"]',
        )
        return [...containers].map(c => (c as HTMLElement).dataset.testid)
      })
    }

    const orderBefore = await getViewOrder()
    expect(orderBefore.length).toBeGreaterThanOrEqual(2)

    // Now try to move first view down
    const viewMenusAfter = await $$('[data-testid="view_menu_icon"]')
    await viewMenusAfter[0].click()
    await delay(300)
    await clickViewOptions()
    const moveDown = await findByText('Move view down', 10000)
    await moveDown.click()
    await delay(500)

    // Verify the order actually changed
    const orderAfter = await getViewOrder()
    expect(
      orderBefore[0] !== orderAfter[0] || orderBefore[1] !== orderAfter[1],
    ).toBe(true)
  })
})
