// MolvicStudios Analytics Snippet v4.0
// Auto-generado — no editar manualmente
// SITE se reemplaza automáticamente al integrar en cada web

;(function () {
  var SITE     = 'prestamorapido.pro'
  var ENDPOINT = 'https://molvicstudios-analytics.josemmolera.workers.dev/track'
  var USER_KEY = 'ms_uid'

  // Bloquear en cualquier entorno no-productivo
  const isLocal = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '' ||          // file://
    location.protocol === 'file:' ||     // file://
    /^192\.168\./.test(location.hostname) ||
    /^10\./.test(location.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname)
  );
  if (isLocal) return;

  // No trackear bots ni previews
  if (
    location.hostname.endsWith('.pages.dev') ||
    /bot|crawl|spider|slurp|bingbot|googlebot/i.test(navigator.userAgent)
  ) return

  // Detectar usuario nuevo vs recurrente
  var isNewUser = !localStorage.getItem(USER_KEY)
  if (isNewUser) localStorage.setItem(USER_KEY, '1')

  // Estado de sesión
  var sessionStart = Date.now()
  var lastActivity = Date.now()
  var pagesInSession = 0
  var maxScrollDepth = 0
  var heartbeatCount = 0

  // Actividad
  document.addEventListener('mousemove',  function(){ lastActivity = Date.now() }, { passive: true })
  document.addEventListener('keydown',    function(){ lastActivity = Date.now() }, { passive: true })
  document.addEventListener('touchstart', function(){ lastActivity = Date.now() }, { passive: true })

  // Scroll depth
  function updateScroll() {
    var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight
    if (docHeight > 0) {
      var pct = Math.round(((window.pageYOffset || document.documentElement.scrollTop) / docHeight) * 100)
      if (pct > maxScrollDepth) maxScrollDepth = Math.min(pct, 100)
    }
  }
  window.addEventListener('scroll', updateScroll, { passive: true })

  // UTM params
  var params = new URLSearchParams(location.search)
  var utmSource   = params.get('utm_source')   || ''
  var utmMedium   = params.get('utm_medium')   || ''
  var utmCampaign = params.get('utm_campaign') || ''

  // Screen
  var screenRes = screen.width + 'x' + screen.height

  function send(eventName, extra) {
    var payload = {
      site:        SITE,
      page:        location.pathname,
      event:       eventName || 'pageview',
      referrer:    document.referrer,
      is_new_user: isNewUser
    }
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) payload[k] = extra[k]
    var body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body)
    } else {
      fetch(ENDPOINT, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      body,
        keepalive: true
      }).catch(function(){})
    }
  }

  // Pageview
  function trackPageview() {
    pagesInSession++
    send('pageview', {
      screen:       screenRes,
      utm_source:   utmSource,
      utm_medium:   utmMedium,
      utm_campaign: utmCampaign
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageview)
  } else {
    trackPageview()
  }

  // Session end
  window.addEventListener('beforeunload', function () {
    var duration = Math.round((Date.now() - sessionStart) / 1000)
    var activeTime = Math.min(duration, Math.round((lastActivity - sessionStart) / 1000))
    if (activeTime > 2) {
      send('session_end', {
        duration:         activeTime,
        scroll_depth:     maxScrollDepth,
        pages_in_session: pagesInSession
      })
    }
  })

  // ── HEARTBEAT (real time on page) ──
  setInterval(function() {
    if (document.visibilityState !== 'hidden' && (Date.now() - lastActivity) < 60000) {
      heartbeatCount++
      send('heartbeat', { beat: heartbeatCount, active_seconds: Math.round((Date.now() - sessionStart) / 1000) })
    }
  }, 30000)

  // ── AD DETECTION (DOM) ──
  function detectAds() {
    var ads = { adsterra: false, adsense: false, mylead: false, adblocker: false }

    // Adsterra: Social Bar, Native Banner, iframes
    var adsterraSel = [
      'div[id*="adsterra"]', 'div[id*="ad-banner"]',
      'iframe[src*="adsterra"]', 'iframe[src*="adstera"]',
      'script[src*="adsterra"]', 'ins.adsterra',
      'div[class*="adsterra"]'
    ]
    for (var i = 0; i < adsterraSel.length; i++) {
      if (document.querySelector(adsterraSel[i])) { ads.adsterra = true; break }
    }

    // AdSense
    var adsenseSel = ['ins.adsbygoogle', 'script[src*="adsbygoogle"]', 'div[id*="google_ads"]']
    for (var i = 0; i < adsenseSel.length; i++) {
      if (document.querySelector(adsenseSel[i])) { ads.adsense = true; break }
    }

    // MyLead
    var myleadSel = ['script[src*="mylead"]', 'div[data-mylead]', 'a[href*="mylead"]', 'iframe[src*="mylead"]']
    for (var i = 0; i < myleadSel.length; i++) {
      if (document.querySelector(myleadSel[i])) { ads.mylead = true; break }
    }

    // Adblocker detection: create a bait element
    var bait = document.createElement('div')
    bait.className = 'ad-banner ads adsbox ad-placement'
    bait.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px'
    bait.innerHTML = '&nbsp;'
    document.body.appendChild(bait)
    setTimeout(function() {
      ads.adblocker = (bait.offsetHeight === 0 || bait.clientHeight === 0 || getComputedStyle(bait).display === 'none')
      try { document.body.removeChild(bait) } catch(x) {}
      send('ad_status', {
        ad_adsterra: ads.adsterra,
        ad_adsense:  ads.adsense,
        ad_mylead:   ads.mylead,
        ad_blocker:  ads.adblocker
      })
    }, 500)
  }

  // Run ad detection after page is fully loaded
  if (document.readyState === 'complete') {
    setTimeout(detectAds, 2000)
  } else {
    window.addEventListener('load', function() { setTimeout(detectAds, 2000) })
  }

  // ── OUTBOUND LINK TRACKING ──
  document.addEventListener('click', function(e) {
    var a = e.target.closest ? e.target.closest('a') : null
    if (!a || !a.href) return
    try {
      var url = new URL(a.href)
      if (url.hostname && url.hostname !== location.hostname && url.protocol.indexOf('http') === 0) {
        send('outbound_click', { outbound_url: url.hostname + url.pathname.slice(0, 50) })
      }
    } catch(x) {}
  }, true)

  // ── PERFORMANCE TIMING (TTFB, FCP) ──
  function sendPerfTiming() {
    try {
      var nav = performance.getEntriesByType('navigation')[0]
      var fcp = 0
      var paint = performance.getEntriesByType('paint')
      for (var i = 0; i < paint.length; i++) {
        if (paint[i].name === 'first-contentful-paint') { fcp = Math.round(paint[i].startTime); break }
      }
      if (nav) {
        send('perf_timing', {
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          fcp: fcp,
          dom_load: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          full_load: Math.round(nav.loadEventEnd - nav.startTime)
        })
      }
    } catch(x) {}
  }
  if (document.readyState === 'complete') {
    setTimeout(sendPerfTiming, 1000)
  } else {
    window.addEventListener('load', function() { setTimeout(sendPerfTiming, 1000) })
  }

  // JS errors (enriched: site, source file, line, stack)
  window.onerror = function(message, source, lineno, colno, error) {
    var src = String(source || '')
    if (src && src.indexOf(SITE) === -1 && src.indexOf(location.hostname) === -1) return false
    send('js_error', {
      error_message: String(message).substring(0, 200),
      error_source: src.substring(0, 200),
      error_line: lineno || 0,
      error_col: colno || 0,
      error_stack: (error && error.stack) ? error.stack.substring(0, 500) : '',
      url: location.href
    })
    return false
  }

  // Web Vitals (LCP, CLS, INP)
  if ('PerformanceObserver' in window) {
    var lcp = 0, cls = 0, inp = 0, vitalsSent = false
    function sendVitals() {
      if (vitalsSent || lcp === 0) return
      vitalsSent = true
      send('web_vitals', {
        lcp: Math.round(lcp),
        cls: Math.round(cls * 1000),
        inp: Math.round(inp)
      })
    }
    try {
      new PerformanceObserver(function(l) {
        var e = l.getEntries(); if (e.length) lcp = e[e.length - 1].startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch(x) {}
    try {
      new PerformanceObserver(function(l) {
        l.getEntries().forEach(function(e) { if (!e.hadRecentInput) cls += e.value })
      }).observe({ type: 'layout-shift', buffered: true })
    } catch(x) {}
    try {
      new PerformanceObserver(function(l) {
        l.getEntries().forEach(function(e) { if (e.interactionId && e.duration > inp) inp = e.duration })
      }).observe({ type: 'event', buffered: true })
    } catch(x) {}
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') sendVitals()
    })
    setTimeout(sendVitals, 30000)
  }

  // Función global para eventos personalizados
  // Uso: window.molvicTrack('doc_generated')
  window.molvicTrack = function(eventName) { send(eventName) }
})()
