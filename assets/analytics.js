// Analytics Snippet v3.0 — minicreditos.pro

;(function () {
  var SITE     = 'minicreditos.pro'
  var ENDPOINT = 'https://molvicstudios-analytics.josemmolera.workers.dev/track'
  var USER_KEY = 'ms_uid'

  // No trackear en desarrollo ni en bots
  if (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
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

  // JS errors
  window.addEventListener('error', function (e) {
    send('js_error', { error_msg: (e.message || 'Unknown').substring(0, 150) })
  })

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
  // Uso: window.mcTrack('evento')
  window.mcTrack = function(eventName) { send(eventName) }
})()
