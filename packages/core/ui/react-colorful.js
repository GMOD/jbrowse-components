/* eslint-disable */
// vendored (e.g. copied into our source tree) because the tooling picks up "import" statements that confuse jest, could confuse other consumers of our modules
// copy of react-colorful/dist/index.esmodule.js

import e, {
  useRef as r,
  useMemo as t,
  useEffect as o,
  useState as a,
  useCallback as l,
  useLayoutEffect as n,
} from 'react'
function s() {
  return (s =
    Object.assign ||
    function (e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = arguments[r]
        for (var o in t)
          Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o])
      }
      return e
    }).apply(this, arguments)
}
function c(e, r) {
  if (null == e) return {}
  var t,
    o,
    a = {},
    l = Object.keys(e)
  for (o = 0; o < l.length; o++) r.indexOf((t = l[o])) >= 0 || (a[t] = e[t])
  return a
}
function u(e) {
  const t = r(e),
    o = r(e => {
      t.current && t.current(e)
    })
  return ((t.current = e), o.current)
}
const i = (e, r = 0, t = 1) => (e > t ? t : e < r ? r : e),
  d = e => 'touches' in e,
  f = e => (e && e.ownerDocument.defaultView) || self,
  h = (e, r, t) => {
    const o = e.getBoundingClientRect(),
      a = d(r)
        ? ((e, r) => {
            for (let t = 0; t < e.length; t++)
              if (e[t].identifier === r) return e[t]
            return e[0]
          })(r.touches, t)
        : r
    return {
      left: i((a.pageX - (o.left + f(e).pageXOffset)) / o.width),
      top: i((a.pageY - (o.top + f(e).pageYOffset)) / o.height),
    }
  },
  v = e => {
    !d(e) && e.preventDefault()
  },
  m = e.memo(a => {
    let { onMove: l, onKey: n } = a,
      i = c(a, ['onMove', 'onKey'])
    const m = r(null),
      g = u(l),
      p = u(n),
      b = r(null),
      _ = r(!1),
      [x, C, E] = t(() => {
        const e = e => {
            ;(v(e),
              (d(e) ? e.touches.length > 0 : e.buttons > 0) && m.current
                ? g(h(m.current, e, b.current))
                : t(!1))
          },
          r = () => t(!1)
        function t(t) {
          const o = _.current,
            a = f(m.current),
            l = t ? a.addEventListener : a.removeEventListener
          ;(l(o ? 'touchmove' : 'mousemove', e),
            l(o ? 'touchend' : 'mouseup', r))
        }
        return [
          ({ nativeEvent: e }) => {
            const r = m.current
            if (r && (v(e), !((e, r) => r && !d(e))(e, _.current) && r)) {
              if (d(e)) {
                _.current = !0
                const r = e.changedTouches || []
                r.length && (b.current = r[0].identifier)
              }
              ;(r.focus(), g(h(r, e, b.current)), t(!0))
            }
          },
          e => {
            const r = e.which || e.keyCode
            r < 37 ||
              r > 40 ||
              (e.preventDefault(),
              p({
                left: 39 === r ? 0.05 : 37 === r ? -0.05 : 0,
                top: 40 === r ? 0.05 : 38 === r ? -0.05 : 0,
              }))
          },
          t,
        ]
      }, [p, g])
    return (
      o(() => E, [E]),
      e.createElement(
        'div',
        s({}, i, {
          onTouchStart: x,
          onMouseDown: x,
          className: 'react-colorful__interactive',
          ref: m,
          onKeyDown: C,
          tabIndex: 0,
          role: 'slider',
        }),
      )
    )
  }),
  g = e => e.filter(Boolean).join(' '),
  p = ({ className: r, color: t, left: o, top: a = 0.5 }) => {
    const l = g(['react-colorful__pointer', r])
    return e.createElement(
      'div',
      { className: l, style: { top: 100 * a + '%', left: 100 * o + '%' } },
      e.createElement('div', {
        className: 'react-colorful__pointer-fill',
        style: { backgroundColor: t },
      }),
    )
  },
  b = (e, r = 0, t = Math.pow(10, r)) => Math.round(t * e) / t,
  _ = { grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) },
  x = e => (
    '#' === e[0] && (e = e.substr(1)),
    e.length < 6
      ? {
          r: parseInt(e[0] + e[0], 16),
          g: parseInt(e[1] + e[1], 16),
          b: parseInt(e[2] + e[2], 16),
          a: 1,
        }
      : {
          r: parseInt(e.substr(0, 2), 16),
          g: parseInt(e.substr(2, 2), 16),
          b: parseInt(e.substr(4, 2), 16),
          a: 1,
        }
  ),
  C = (e, r = 'deg') => Number(e) * (_[r] || 1),
  E = e => {
    const r =
      /hsla?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[,\s]+(-?\d*\.?\d+)%?[,\s]+(-?\d*\.?\d+)%?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i.exec(
        e,
      )
    return r
      ? M({
          h: C(r[1], r[2]),
          s: Number(r[3]),
          l: Number(r[4]),
          a: void 0 === r[5] ? 1 : Number(r[5]) / (r[6] ? 100 : 1),
        })
      : { h: 0, s: 0, v: 0, a: 1 }
  },
  H = E,
  M = ({ h: e, s: r, l: t, a: o }) => ({
    h: e,
    s: (r *= (t < 50 ? t : 100 - t) / 100) > 0 ? ((2 * r) / (t + r)) * 100 : 0,
    v: t + r,
    a: o,
  }),
  N = ({ h: e, s: r, v: t, a: o }) => {
    const a = ((200 - r) * t) / 100
    return {
      h: b(e),
      s: b(
        a > 0 && a < 200 ? ((r * t) / 100 / (a <= 100 ? a : 200 - a)) * 100 : 0,
      ),
      l: b(a / 2),
      a: b(o, 2),
    }
  },
  w = e => {
    const { h: r, s: t, l: o } = N(e)
    return `hsl(${r}, ${t}%, ${o}%)`
  },
  $ = e => {
    const { h: r, s: t, l: o, a } = N(e)
    return `hsla(${r}, ${t}%, ${o}%, ${a})`
  },
  y = ({ h: e, s: r, v: t, a: o }) => {
    ;((e = (e / 360) * 6), (r /= 100), (t /= 100))
    const a = Math.floor(e),
      l = t * (1 - r),
      n = t * (1 - (e - a) * r),
      s = t * (1 - (1 - e + a) * r),
      c = a % 6
    return {
      r: b(255 * [t, n, l, l, s, t][c]),
      g: b(255 * [s, t, t, n, l, l][c]),
      b: b(255 * [l, l, s, t, t, n][c]),
      a: b(o, 2),
    }
  },
  q = e => {
    const r =
      /hsva?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[,\s]+(-?\d*\.?\d+)%?[,\s]+(-?\d*\.?\d+)%?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i.exec(
        e,
      )
    return r
      ? B({
          h: C(r[1], r[2]),
          s: Number(r[3]),
          v: Number(r[4]),
          a: void 0 === r[5] ? 1 : Number(r[5]) / (r[6] ? 100 : 1),
        })
      : { h: 0, s: 0, v: 0, a: 1 }
  },
  k = q,
  O = e => {
    const r =
      /rgba?\(?\s*(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i.exec(
        e,
      )
    return r
      ? z({
          r: Number(r[1]) / (r[2] ? 100 / 255 : 1),
          g: Number(r[3]) / (r[4] ? 100 / 255 : 1),
          b: Number(r[5]) / (r[6] ? 100 / 255 : 1),
          a: void 0 === r[7] ? 1 : Number(r[7]) / (r[8] ? 100 : 1),
        })
      : { h: 0, s: 0, v: 0, a: 1 }
  },
  I = O,
  j = e => {
    const r = e.toString(16)
    return r.length < 2 ? '0' + r : r
  },
  z = ({ r: e, g: r, b: t, a: o }) => {
    const a = Math.max(e, r, t),
      l = a - Math.min(e, r, t),
      n = l
        ? a === e
          ? (r - t) / l
          : a === r
            ? 2 + (t - e) / l
            : 4 + (e - r) / l
        : 0
    return {
      h: b(60 * (n < 0 ? n + 6 : n)),
      s: b(a ? (l / a) * 100 : 0),
      v: b((a / 255) * 100),
      a: o,
    }
  },
  B = e => ({ h: b(e.h), s: b(e.s), v: b(e.v), a: b(e.a, 2) }),
  D = e.memo(({ className: r, hue: t, onChange: o }) => {
    const a = g(['react-colorful__hue', r])
    return e.createElement(
      'div',
      { className: a },
      e.createElement(
        m,
        {
          onMove: e => {
            o({ h: 360 * e.left })
          },
          onKey: e => {
            o({ h: i(t + 360 * e.left, 0, 360) })
          },
          'aria-label': 'Hue',
          'aria-valuetext': b(t),
        },
        e.createElement(p, {
          className: 'react-colorful__hue-pointer',
          left: t / 360,
          color: w({ h: t, s: 100, v: 100, a: 1 }),
        }),
      ),
    )
  }),
  K = e.memo(({ hsva: r, onChange: t }) => {
    const o = { backgroundColor: w({ h: r.h, s: 100, v: 100, a: 1 }) }
    return e.createElement(
      'div',
      { className: 'react-colorful__saturation', style: o },
      e.createElement(
        m,
        {
          onMove: e => {
            t({ s: 100 * e.left, v: 100 - 100 * e.top })
          },
          onKey: e => {
            t({
              s: i(r.s + 100 * e.left, 0, 100),
              v: i(r.v - 100 * e.top, 0, 100),
            })
          },
          'aria-label': 'Color',
          'aria-valuetext': `Saturation ${b(r.s)}%, Brightness ${b(r.v)}%`,
        },
        e.createElement(p, {
          className: 'react-colorful__saturation-pointer',
          top: 1 - r.v / 100,
          left: r.s / 100,
          color: w(r),
        }),
      ),
    )
  }),
  L = (e, r) => {
    if (e === r) return !0
    for (const t in e) if (e[t] !== r[t]) return !1
    return !0
  },
  A = (e, r) => e.replace(/\s/g, '') === r.replace(/\s/g, '')
function S(e, t, n) {
  const s = u(n),
    [c, i] = a(() => e.toHsva(t)),
    d = r({ color: t, hsva: c })
  ;(o(() => {
    if (!e.equal(t, d.current.color)) {
      const r = e.toHsva(t)
      ;((d.current = { hsva: r, color: t }), i(r))
    }
  }, [t, e]),
    o(() => {
      let r
      L(c, d.current.hsva) ||
        e.equal((r = e.fromHsva(c)), d.current.color) ||
        ((d.current = { hsva: c, color: r }), s(r))
    }, [c, e, s]))
  const f = l(e => {
    i(r => Object.assign({}, r, e))
  }, [])
  return [c, f]
}
const T = 'undefined' != typeof window ? n : o
let F
const P = () =>
    F || ('undefined' != typeof __webpack_nonce__ ? __webpack_nonce__ : void 0),
  X = e => {
    F = e
  },
  Y = new Map(),
  R = e => {
    T(() => {
      const r = e.current ? e.current.ownerDocument : document
      if (void 0 !== r && !Y.has(r)) {
        const e = r.createElement('style')
        ;((e.innerHTML =
          '.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}.react-colorful__saturation{position:relative;flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border-radius:inherit}.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}.react-colorful__hue{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.react-colorful__last-control{border-radius:0 0 8px 8px}.react-colorful__interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}.react-colorful__pointer{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}.react-colorful__interactive:focus .react-colorful__pointer{transform:translate(-50%,-50%) scale(1.1)}.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url(\'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>\')}.react-colorful__saturation-pointer{z-index:3}.react-colorful__hue-pointer{z-index:2}'),
          Y.set(r, e))
        const t = P()
        ;(t && e.setAttribute('nonce', t), r.head.appendChild(e))
      }
    }, [])
  },
  V = t => {
    let {
        className: o,
        colorModel: a,
        color: l = a.defaultColor,
        onChange: n,
      } = t,
      u = c(t, ['className', 'colorModel', 'color', 'onChange'])
    const i = r(null)
    R(i)
    const [d, f] = S(a, l, n),
      h = g(['react-colorful', o])
    return e.createElement(
      'div',
      s({}, u, { ref: i, className: h }),
      e.createElement(K, { hsva: d, onChange: f }),
      e.createElement(D, {
        hue: d.h,
        onChange: f,
        className: 'react-colorful__last-control',
      }),
    )
  },
  G = {
    defaultColor: '000',
    toHsva: e => z(x(e)),
    fromHsva: e => (({ r: e, g: r, b: t }) => '#' + j(e) + j(r) + j(t))(y(e)),
    equal: (e, r) => e.toLowerCase() === r.toLowerCase() || L(x(e), x(r)),
  },
  J = r => e.createElement(V, s({}, r, { colorModel: G })),
  Q = ({ className: r, hsva: t, onChange: o }) => {
    const a = {
        backgroundImage: `linear-gradient(90deg, ${$(
          Object.assign({}, t, { a: 0 }),
        )}, ${$(Object.assign({}, t, { a: 1 }))})`,
      },
      l = g(['react-colorful__alpha', r])
    return e.createElement(
      'div',
      { className: l },
      e.createElement('div', {
        className: 'react-colorful__alpha-gradient',
        style: a,
      }),
      e.createElement(
        m,
        {
          onMove: e => {
            o({ a: e.left })
          },
          onKey: e => {
            o({ a: i(t.a + e.left) })
          },
          'aria-label': 'Alpha',
          'aria-valuetext': `${b(100 * t.a)}%`,
        },
        e.createElement(p, {
          className: 'react-colorful__alpha-pointer',
          left: t.a,
          color: $(t),
        }),
      ),
    )
  },
  U = t => {
    let {
        className: o,
        colorModel: a,
        color: l = a.defaultColor,
        onChange: n,
      } = t,
      u = c(t, ['className', 'colorModel', 'color', 'onChange'])
    const i = r(null)
    R(i)
    const [d, f] = S(a, l, n),
      h = g(['react-colorful', o])
    return e.createElement(
      'div',
      s({}, u, { ref: i, className: h }),
      e.createElement(K, { hsva: d, onChange: f }),
      e.createElement(D, { hue: d.h, onChange: f }),
      e.createElement(Q, {
        hsva: d,
        onChange: f,
        className: 'react-colorful__last-control',
      }),
    )
  },
  W = {
    defaultColor: { h: 0, s: 0, l: 0, a: 1 },
    toHsva: M,
    fromHsva: N,
    equal: L,
  },
  Z = r => e.createElement(U, s({}, r, { colorModel: W })),
  ee = { defaultColor: 'hsla(0, 0%, 0%, 1)', toHsva: E, fromHsva: $, equal: A },
  re = r => e.createElement(U, s({}, r, { colorModel: ee })),
  te = {
    defaultColor: { h: 0, s: 0, l: 0 },
    toHsva: ({ h: e, s: r, l: t }) => M({ h: e, s: r, l: t, a: 1 }),
    fromHsva: e => (({ h: e, s: r, l: t }) => ({ h: e, s: r, l: t }))(N(e)),
    equal: L,
  },
  oe = r => e.createElement(V, s({}, r, { colorModel: te })),
  ae = { defaultColor: 'hsl(0, 0%, 0%)', toHsva: H, fromHsva: w, equal: A },
  le = r => e.createElement(V, s({}, r, { colorModel: ae })),
  ne = {
    defaultColor: { h: 0, s: 0, v: 0, a: 1 },
    toHsva: e => e,
    fromHsva: B,
    equal: L,
  },
  se = r => e.createElement(U, s({}, r, { colorModel: ne })),
  ce = {
    defaultColor: 'hsva(0, 0%, 0%, 1)',
    toHsva: q,
    fromHsva: e => {
      const { h: r, s: t, v: o, a } = B(e)
      return `hsva(${r}, ${t}%, ${o}%, ${a})`
    },
    equal: A,
  },
  ue = r => e.createElement(U, s({}, r, { colorModel: ce })),
  ie = {
    defaultColor: { h: 0, s: 0, v: 0 },
    toHsva: ({ h: e, s: r, v: t }) => ({ h: e, s: r, v: t, a: 1 }),
    fromHsva: e => {
      const { h: r, s: t, v: o } = B(e)
      return { h: r, s: t, v: o }
    },
    equal: L,
  },
  de = r => e.createElement(V, s({}, r, { colorModel: ie })),
  fe = {
    defaultColor: 'hsv(0, 0%, 0%)',
    toHsva: k,
    fromHsva: e => {
      const { h: r, s: t, v: o } = B(e)
      return `hsv(${r}, ${t}%, ${o}%)`
    },
    equal: A,
  },
  he = r => e.createElement(V, s({}, r, { colorModel: fe })),
  ve = {
    defaultColor: { r: 0, g: 0, b: 0, a: 1 },
    toHsva: z,
    fromHsva: y,
    equal: L,
  },
  me = r => e.createElement(U, s({}, r, { colorModel: ve })),
  ge = {
    defaultColor: 'rgba(0, 0, 0, 1)',
    toHsva: O,
    fromHsva: e => {
      const { r, g: t, b: o, a } = y(e)
      return `rgba(${r}, ${t}, ${o}, ${a})`
    },
    equal: A,
  },
  pe = r => e.createElement(U, s({}, r, { colorModel: ge })),
  be = {
    defaultColor: { r: 0, g: 0, b: 0 },
    toHsva: ({ r: e, g: r, b: t }) => z({ r: e, g: r, b: t, a: 1 }),
    fromHsva: e => (({ r: e, g: r, b: t }) => ({ r: e, g: r, b: t }))(y(e)),
    equal: L,
  },
  _e = r => e.createElement(V, s({}, r, { colorModel: be })),
  xe = {
    defaultColor: 'rgb(0, 0, 0)',
    toHsva: I,
    fromHsva: e => {
      const { r, g: t, b: o } = y(e)
      return `rgb(${r}, ${t}, ${o})`
    },
    equal: A,
  },
  Ce = r => e.createElement(V, s({}, r, { colorModel: xe })),
  Ee = /^#?([0-9A-F]{3,8})$/i,
  He = r => {
    const {
        color: t = '',
        onChange: n,
        onBlur: i,
        escape: d,
        validate: f,
        format: h,
        process: v,
      } = r,
      m = c(r, [
        'color',
        'onChange',
        'onBlur',
        'escape',
        'validate',
        'format',
        'process',
      ]),
      [g, p] = a(() => d(t)),
      b = u(n),
      _ = u(i),
      x = l(
        e => {
          const r = d(e.target.value)
          ;(p(r), f(r) && b(v ? v(r) : r))
        },
        [d, v, f, b],
      ),
      C = l(
        e => {
          ;(f(e.target.value) || p(d(t)), _(e))
        },
        [t, d, f, _],
      )
    return (
      o(() => {
        p(d(t))
      }, [t, d]),
      e.createElement(
        'input',
        s({}, m, {
          value: h ? h(g) : g,
          spellCheck: 'false',
          onChange: x,
          onBlur: C,
        }),
      )
    )
  },
  Me = e => '#' + e,
  Ne = r => {
    const { prefixed: t, alpha: o } = r,
      a = c(r, ['prefixed', 'alpha']),
      n = l(e => e.replace(/([^0-9A-F]+)/gi, '').substr(0, o ? 8 : 6), [o]),
      u = l(
        e =>
          ((e, r) => {
            const t = Ee.exec(e),
              o = t ? t[1].length : 0
            return 3 === o || 6 === o || (!!r && 4 === o) || (!!r && 8 === o)
          })(e, o),
        [o],
      )
    return e.createElement(
      He,
      s({}, a, {
        escape: n,
        format: t ? Me : void 0,
        process: Me,
        validate: u,
      }),
    )
  }
export {
  Ne as HexColorInput,
  J as HexColorPicker,
  oe as HslColorPicker,
  le as HslStringColorPicker,
  Z as HslaColorPicker,
  re as HslaStringColorPicker,
  de as HsvColorPicker,
  he as HsvStringColorPicker,
  se as HsvaColorPicker,
  ue as HsvaStringColorPicker,
  _e as RgbColorPicker,
  Ce as RgbStringColorPicker,
  me as RgbaColorPicker,
  pe as RgbaStringColorPicker,
  X as setNonce,
}
