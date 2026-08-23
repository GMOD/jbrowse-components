/* eslint-disable no-console */
// One-off probe (not a suite): does clicking the scroll-zoom ToggleButton and
// then leaving/returning to the browser tab leave its Tooltip open and its
// TouchRipple animating? Both symptoms are browser heuristics with no jsdom
// equivalent — `:focus-visible` after a tab restore, and whether the pointer
// leaving the element while the document is hidden produces a mouseleave at
// all — so this can only be asked of a real Chrome.
//
//     PRESS_KEY=1 node browser-tests/probe-tab-switch-tooltip.ts
//     PRESS_KEY=1 CYCLES=3 HEADLESS=0 node browser-tests/probe-tab-switch-tooltip.ts
//
// KEYBOARD=1 focuses the button with the keyboard first, so the two focus
// origins can be compared.
//
// It serves `build/`, so `childAnimation.duration` reports whatever theme that
// bundle was built with — 0.05s on one predating the scoped override, which is
// the strobe itself, and 2.5s once rebuilt.

import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const HEADLESS = process.env.HEADLESS !== '0'
const KEYBOARD = process.env.KEYBOARD === '1'
const MOVE_AWAY = process.env.MOVE_AWAY === '1'
// A keypress anywhere after the click is what flips Chrome's "last input was
// the keyboard" flag, which is the state it consults when it restores focus on
// tab return. PRESS_KEY=1 is the reproducing path; without it, nothing happens.
const PRESS_KEY = process.env.PRESS_KEY === '1'
const CYCLES = Number(process.env.CYCLES || 1)

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_filtered_vcf'],
    },
  ],
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const BUTTON = 'button[value="scrollZoom"]'

async function snapshot(page: Page, when: string) {
  const s = await page.evaluate(sel => {
    const btn = document.querySelector(sel)
    const tooltips = [...document.querySelectorAll('.MuiTooltip-tooltip')]
    const rippleRoot = btn?.querySelector('.MuiTouchRipple-root')
    const ripples = [...(rippleRoot?.children ?? [])]
    return {
      tooltipCount: tooltips.length,
      tooltipText: tooltips.map(t => t.textContent.slice(0, 30)),
      ariaDescribedby: btn?.getAttribute('aria-describedby'),
      buttonClass: btn?.className,
      focusVisibleClass: !!btn?.classList.contains('Mui-focusVisible'),
      isActiveElement: document.activeElement === btn,
      activeElement: document.activeElement?.tagName,
      matchesFocusVisible: btn ? btn.matches(':focus-visible') : null,
      matchesHover: btn ? btn.matches(':hover') : null,
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      rippleChildren: ripples.length,
      rippleDetail: ripples.map(r => {
        const child = r.firstElementChild
        const cs = child ? getComputedStyle(child) : undefined
        return {
          cls: r.className,
          childCls: child?.className,
          childAnimation: cs && {
            name: cs.animationName,
            duration: cs.animationDuration,
            iterations: cs.animationIterationCount,
            delay: cs.animationDelay,
          },
        }
      }),
      pulseSpans: btn?.querySelectorAll('[data-testid="scroll-zoom-pulse"]')
        .length,
    }
  }, BUTTON)
  console.log(`\n--- ${when} ---`)
  console.log(JSON.stringify(s, null, 2))
  return s
}

async function main() {
  const { server, port } = await startServerOnFreePort(3000)
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()

  page.on('console', m => {
    const t = m.text()
    if (t.startsWith('[probe]')) {
      console.log(t)
    }
  })

  await page.evaluateOnNewDocument(() => {
    const t0 = performance.now()
    const at = () => `t+${Math.round(performance.now() - t0)}ms`
    const log = (...a: unknown[]) => {
      console.log('[probe]', at(), ...a)
    }
    for (const type of [
      'visibilitychange',
      'focus',
      'blur',
      'focusin',
      'focusout',
      'pointerover',
      'pointerout',
      'mouseover',
      'mouseleave',
      'mouseenter',
      'mousemove',
    ]) {
      document.addEventListener(
        type,
        e => {
          const el = e.target instanceof Element ? e.target : undefined
          const onButton = !!el?.closest('button[value="scrollZoom"]')
          if (
            type === 'mousemove' ||
            (!onButton && type !== 'visibilitychange' && type !== 'focus')
          ) {
            return
          }
          log(
            `event ${type}`,
            'target=',
            el?.tagName,
            'vis=',
            document.visibilityState,
            'onButton=',
            onButton,
          )
        },
        true,
      )
    }
    window.addEventListener('focus', () => {
      log('window focus, vis=', document.visibilityState)
    })
    window.addEventListener('blur', () => {
      log('window blur, vis=', document.visibilityState)
    })

    const observe = () => {
      const btn = document.querySelector('button[value="scrollZoom"]')
      const root = btn?.querySelector('.MuiTouchRipple-root')
      if (!root) {
        setTimeout(observe, 500)
        return
      }
      log('watching ripple root')
      new MutationObserver(muts => {
        for (const m of muts) {
          log(
            'ripple mutation',
            m.type,
            'added=',
            m.addedNodes.length,
            'removed=',
            m.removedNodes.length,
            'now=',
            root.children.length,
            [...root.children].map(c => c.className).join(' | '),
          )
        }
      }).observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      })
      new MutationObserver(() => {
        log('button class ->', btn!.className)
      }).observe(btn!, { attributes: true, attributeFilter: ['class'] })
    }
    observe()
  })

  const url = `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=TabSwitch`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector(BUTTON, { timeout: 120000 })
  await delay(4000)

  const btn = (await page.$(BUTTON))!
  const box = (await btn.boundingBox())!
  console.log('button box', JSON.stringify(box))

  if (KEYBOARD) {
    await page.evaluate(sel => {
      document.querySelector<HTMLElement>(sel)!.focus()
    }, BUTTON)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await delay(500)
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await delay(1200)
  await snapshot(page, 'hovered, before click')

  // Hold the button down and read the click ripple while it is still on the
  // element: the whole point of the theme override is that this one stays fast.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await delay(30)
  console.log(
    '\nclick ripple while held:',
    JSON.stringify(
      await page.evaluate(sel => {
        const root = document
          .querySelector(sel)
          ?.querySelector('.MuiTouchRipple-root')
        return [...(root?.children ?? [])].map(r => {
          const cs = getComputedStyle(r)
          const child = r.firstElementChild
          const childCs = child ? getComputedStyle(child) : undefined
          return {
            cls: r.className.replace(/css-\S+ /, ''),
            rippleDuration: cs.animationDuration,
            rippleIterations: cs.animationIterationCount,
            childCls: child?.className,
            childDuration: childCs?.animationDuration,
            childIterations: childCs?.animationIterationCount,
          }
        })
      }, BUTTON),
      null,
      2,
    ),
  )
  await page.mouse.up()
  await delay(1200)
  await snapshot(page, 'after click (mouse still on button)')

  if (MOVE_AWAY) {
    await page.mouse.move(box.x + box.width / 2, 5)
    await delay(1000)
    await snapshot(page, 'after moving pointer off the button')
  }

  if (PRESS_KEY) {
    await page.keyboard.press('Escape')
    await delay(400)
    await snapshot(page, 'after one keypress (Escape), still on the tab')
  }

  const other = await browser.newPage()
  await other.goto('about:blank')

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await page.evaluate(n => {
      console.log(`[probe] === leaving the tab, cycle ${n} ===`)
    }, cycle)
    await other.bringToFront()
    await delay(2000)
    await page.bringToFront()
    await page.evaluate(n => {
      console.log(`[probe] === back on the tab, cycle ${n} ===`)
    }, cycle)
    await delay(400)
    await snapshot(page, `back from tab switch, cycle ${cycle}`)
  }
  await delay(2500)
  await snapshot(page, '2.5s after the last return (no pointer movement)')

  await page.screenshot({ path: '/tmp/tab-switch-after.png' })
  console.log('\nshot: /tmp/tab-switch-after.png')

  await browser.close()
  server.close()
}

await main()
