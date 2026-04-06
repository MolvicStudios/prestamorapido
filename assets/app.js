/* assets/app.js — minicreditos.pro v0.4
 * Vanilla JS puro — sin frameworks ni librerías externas
 * Compatible con los últimos 2 años de navegadores modernos
 */

'use strict'

// ═══════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════

const DATA_PATH = 'data/prestamistas.json'
const COOKIE_KEY = 'mc_cookie_consent'
const PLAZO_OPTIONS = [7, 15, 30, 60, 90, 180, 365]

// ═══════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════
let appState = {
  data:               null,      // JSON completo
  activeCountry:      null,      // código de país activo (es, mx, co…)
  activeAmount:       null,      // importe seleccionado (valor real, no %)
  activePlazo:        30,        // días
  activeTipo:         'todos',   // 'todos' | 'prestamista_directo' | 'broker'
  activeAsnef:        false,     // solo mostrar entidades que aceptan ASNEF
  activeAvalCoche:    false,     // solo mostrar entidades con aval de coche
  activeSinNomina:    false,     // solo mostrar entidades que no exigen nómina
  activePrimerGratis: false,     // solo mostrar entidades con primer préstamo gratis
  _initialized:       false,     // true tras la carga inicial
}

// ═══════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════

/** Formatea importe con Intl.NumberFormat según locale y moneda */
function formatAmount(amount, locale, currency) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount)
}

/** Formatea días en una cadena legible (días para <60, meses para ≥60) */
function formatPlazoDays(days) {
  if (days < 60) return `${days} días`
  const m = Math.round(days / 30.44)
  return `${m} ${m === 1 ? 'mes' : 'meses'}`
}

/** Escapa HTML para evitar XSS en contenido dinámico */
function esc(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Obtiene el país de la URL (?pais=es) */
function getCountryFromURL() {
  const params = new URLSearchParams(window.location.search)
  const p = params.get('pais')
  return p ? p.toLowerCase() : null
}

/** Emoji de bandera para los códigos de país */
function countryFlag(code) {
  const flags = { es: '🇪🇸', mx: '🇲🇽', co: '🇨🇴', us: '🇺🇸', cl: '🇨🇱', pe: '🇵🇪', ec: '🇪🇨' }
  return flags[code] || '🌍'
}

// ═══════════════════════════════════════════════════
// FASE 1 — CARGA DE DATOS
// ═══════════════════════════════════════════════════

async function loadData() {
  const res = await fetch(DATA_PATH)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ═══════════════════════════════════════════════════
// FASE 2 — INICIALIZACIÓN DE UI
// ═══════════════════════════════════════════════════

/** Crea los tabs de país basados en las claves del JSON */
function initCountryTabs(countries) {
  const container = document.getElementById('countryTabs')
  if (!container) return

  container.innerHTML = ''
  Object.entries(countries).forEach(([code, country]) => {
    const btn = document.createElement('button')
    btn.className = 'country-tab'
    btn.type = 'button'
    btn.dataset.country = code
    btn.setAttribute('role', 'tab')
    btn.setAttribute('aria-selected', 'false')
    btn.setAttribute('aria-controls', 'resultsGrid')
    btn.innerHTML = `<span class="country-flag" aria-hidden="true">${countryFlag(code)}</span>${esc(country.name)}`
    btn.addEventListener('click', () => selectCountry(code))
    container.appendChild(btn)
  })
}

/** Activa un país: actualiza tabs, slider y resulados */
function selectCountry(code) {
  const { countries } = appState.data
  if (!countries[code]) return

  appState.activeCountry = code
  const countryData = countries[code]

  // Actualizar tabs
  document.querySelectorAll('.country-tab').forEach(btn => {
    const isActive = btn.dataset.country === code
    btn.classList.toggle('active', isActive)
    btn.setAttribute('aria-selected', String(isActive))
  })

  // Actualizar slider y su importe por defecto
  updateAmountSlider(countryData)

  // Actualizar plazo buttons (deshabilitar los que no apliquen)
  updatePlazoBtns(countryData)

  // Renderizar resultados
  applyFilters()

  // Auto-scroll a resultados (solo si el usuario ya interactuó, no en la carga inicial)
  if (appState._initialized) {
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** Actualiza el slider de importe según el país */
function updateAmountSlider(countryData) {
  const slider = document.getElementById('amountSlider')
  const minEl = document.getElementById('sliderMin')
  const maxEl = document.getElementById('sliderMax')
  if (!slider) return

  const { amount_min, amount_max, amount_step, locale, currency } = countryData

  slider.min = 0
  slider.max = 100
  // Valor por defecto: ~40% del rango
  slider.value = 40

  minEl.textContent = formatAmount(amount_min, locale, currency)
  maxEl.textContent = formatAmount(amount_max, locale, currency)

  // Calcular valor real (40% del rango, redondeado al step)
  const rawValue = amount_min + 0.4 * (amount_max - amount_min)
  const step = amount_step || 1
  appState.activeAmount = Math.round(rawValue / step) * step

  updateAmountDisplay()
}

/** Recalcula el importe real desde el valor (0-100) del slider */
function sliderToAmount(pct) {
  const { countries } = appState.data
  const countryData = countries[appState.activeCountry]
  const { amount_min, amount_max, amount_step } = countryData
  const step = amount_step || 1
  const raw = amount_min + (pct / 100) * (amount_max - amount_min)
  return Math.min(Math.max(Math.round(raw / step) * step, amount_min), amount_max)
}

/** Actualiza el display del importe seleccionado */
function updateAmountDisplay() {
  const display = document.getElementById('amountDisplay')
  if (!display || !appState.activeCountry || !appState.data) return

  const countryData = appState.data.countries[appState.activeCountry]
  display.textContent = formatAmount(
    appState.activeAmount,
    countryData.locale,
    countryData.currency
  )
}

/** Habilita/deshabilita los botones de plazo según el país */
function updatePlazoBtns(countryData) {
  const { prestamistas } = countryData
  const btns = document.querySelectorAll('.plazo-btn')

  btns.forEach(btn => {
    const plazo = parseInt(btn.dataset.plazo, 10)
    // Habilitado si al menos UN prestamista puede manejar ese plazo
    const hasLender = prestamistas.some(
      p => p.plazo_min_dias <= plazo && p.plazo_max_dias >= plazo
    )
    btn.disabled = !hasLender
    btn.setAttribute('aria-disabled', String(!hasLender))
    if (!hasLender && btn.classList.contains('active')) {
      btn.classList.remove('active')
      // Seleccionar el primer plazo disponible
      const firstAvailable = PLAZO_OPTIONS.find(d =>
        prestamistas.some(p => p.plazo_min_dias <= d && p.plazo_max_dias >= d)
      )
      if (firstAvailable) {
        appState.activePlazo = firstAvailable
        document.querySelector(`.plazo-btn[data-plazo="${firstAvailable}"]`)?.classList.add('active')
      }
    }
  })
}

// ═══════════════════════════════════════════════════
// FASE 3 — FILTRADO
// ═══════════════════════════════════════════════════

/**
 * Filtra prestamistas según los filtros activos.
 * @param {Array} prestamistas
 * @param {Object} opts - { amount, plazo, tipo }
 * @returns {Array}
 */
function filterResults(prestamistas, { amount, plazo, tipo, asnef, avalCoche, sinNomina, primerGratis }) {
  return prestamistas.filter(p => {
    const amountOk       = p.importe_min <= amount && p.importe_max >= amount
    const plazoOk        = p.plazo_min_dias <= plazo && p.plazo_max_dias >= plazo
    const tipoOk         = tipo === 'todos' || p.tipo === tipo
    const asnefOk        = !asnef || p.acepta_asnef === true
    const avalOk         = !avalCoche || p.aval_coche === true
    const sinNominaOk    = !sinNomina || p.sin_nomina === true
    const primerGratisOk = !primerGratis || p.primer_prestamo_gratis === true
    return amountOk && plazoOk && tipoOk && asnefOk && avalOk && sinNominaOk && primerGratisOk
  })
}

/** Aplica todos los filtros y re-renderiza */
function applyFilters() {
  if (!appState.activeCountry || !appState.data) return

  const countryData = appState.data.countries[appState.activeCountry]
  const filtered = filterResults(countryData.prestamistas, {
    amount:       appState.activeAmount,
    plazo:        appState.activePlazo,
    tipo:         appState.activeTipo,
    asnef:        appState.activeAsnef,
    avalCoche:    appState.activeAvalCoche,
    sinNomina:    appState.activeSinNomina,
    primerGratis: appState.activePrimerGratis,
  })

  renderResults(filtered, countryData)
}

// ═══════════════════════════════════════════════════
// FASE 4 — RENDERIZADO DE CARDS
// ═══════════════════════════════════════════════════

/** Renderiza el listado de cards en el DOM */
function renderResults(prestamistas, countryData) {
  const grid = document.getElementById('resultsGrid')
  const countEl = document.getElementById('resultsCount')
  if (!grid) return

  // Ocultar loading
  const loadingEl = document.getElementById('resultsLoading')
  if (loadingEl) loadingEl.style.display = 'none'

  // Actualizar contador
  if (countEl) {
    const country = esc(countryData.name)
    const amount  = formatAmount(appState.activeAmount, countryData.locale, countryData.currency)
    const plazo   = appState.activePlazo
    if (prestamistas.length === 0) {
      countEl.innerHTML = `<strong>0 entidades</strong> para ${country} · ${amount} · ${plazo} días`
    } else {
      countEl.innerHTML = `<strong>${prestamistas.length} entidad${prestamistas.length > 1 ? 'es' : ''}</strong> encontrada${prestamistas.length > 1 ? 's' : ''} para <strong>${country}</strong> · ${amount} · ${plazo} días`
    }
  }

  // Limpiar grid (mantener el loading element pero ocultarlo)
  const existingCards = grid.querySelectorAll('.result-card, .results-empty')
  existingCards.forEach(el => el.remove())

  if (prestamistas.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'results-empty'
    empty.setAttribute('role', 'listitem')
    empty.innerHTML = `
      <strong>Sin resultados para estos filtros</strong>
      Intenta ampliar el importe, cambiar el plazo o seleccionar "Todos" en el tipo de entidad.
    `
    grid.appendChild(empty)
    return
  }

  // Crear documento fragmento para mejor rendimiento
  const frag = document.createDocumentFragment()
  prestamistas.forEach(p => {
    const card = buildResultCard(p, countryData)
    frag.appendChild(card)
  })
  grid.appendChild(frag)
}

/** Construye el DOM de una card de resultado */
function buildResultCard(p, countryData) {
  const { locale, currency, regulator } = countryData
  const url = p.afiliado_url || p.url

  const article = document.createElement('article')
  article.className = 'result-card'
  article.setAttribute('role', 'listitem')
  article.setAttribute('aria-label', `Entidad: ${p.nombre}`)

  // Badges
  const tipoBadgeClass  = p.tipo === 'prestamista_directo' ? 'badge-directo' : 'badge-broker'
  const tipoBadgeLabel  = p.tipo === 'prestamista_directo' ? 'Directo' : 'Broker'
  const freeBadge = p.primer_prestamo_gratis
    ? `<span class="badge badge-free" title="Primer préstamo sin intereses para nuevos clientes">🎁 1er préstamo gratis</span>`
    : ''
  const asnefBadge = p.acepta_asnef
    ? appState.activeCountry === 'us'
      ? `<span class="badge badge-asnef" title="Acepta solicitantes sin historial crediticio en EE.UU. o con ITIN">✓ Sin historial / ITIN</span>`
      : `<span class="badge badge-asnef" title="Acepta solicitantes en ficheros de morosos ASNEF / Buró">✓ Acepta ASNEF</span>`
    : ''
  const sinNominaBadge = p.sin_nomina
    ? `<span class="badge badge-nomina" title="No requiere nómina ni contrato fijo">Sin nómina</span>`
    : ''
  const velocidadBadge = p.velocidad
    ? `<span class="badge badge-speed" title="Tiempo estimado hasta recibir el dinero">⚡ ${esc(p.velocidad)}</span>`
    : ''
  const avalBadge = p.aval_coche
    ? `<span class="badge badge-aval" title="Requiere aval de vehículo como garantía">Aval coche</span>`
    : ''

  // Meta values
  const importeRange = `${formatAmount(p.importe_min, locale, currency)} – ${formatAmount(p.importe_max, locale, currency)}`
  const plazoRange   = `${formatPlazoDays(p.plazo_min_dias)} – ${formatPlazoDays(p.plazo_max_dias)}`

  // Notas: filtrar el comentario VERIFICAR si existe
  const notas = esc(p.notas || '')

  const reguladoHtml = p.regulado
    ? `<p class="card-regulated">${esc(regulator)}</p>`
    : ''

  article.innerHTML = `
    <div class="card-main">
      <div class="card-name-row">
        <h3 class="card-name">${esc(p.nombre)}</h3>
        <span class="badge ${tipoBadgeClass}">${tipoBadgeClass === 'badge-directo' ? '▶' : '⇄'} ${tipoBadgeLabel}</span>
        ${freeBadge}
        ${asnefBadge}
        ${sinNominaBadge}
        ${velocidadBadge}
        ${avalBadge}
      </div>
      <div class="card-meta">
        <div class="meta-item">
          <div class="meta-label">Importe</div>
          <div class="meta-value">${importeRange}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Plazo</div>
          <div class="meta-value">${plazoRange}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Velocidad</div>
          <div class="meta-value">${esc(p.velocidad || '—')}</div>
        </div>
      </div>
      ${notas ? `<p class="card-notes">${notas}</p>` : ''}
      ${reguladoHtml}
    </div>
    <div class="card-action">
      <a
        href="${esc(url)}"
        class="btn-solicitar"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Solicitar en ${esc(p.nombre)} (abre en nueva pestaña)"
      >Solicitar</a>
    </div>
  `

  return article
}

// ═══════════════════════════════════════════════════
// FASE 6 — GLOSARIO
// ═══════════════════════════════════════════════════

/** Filtra el glosario en tiempo real */
function filterGlossary(query) {
  const q = query.toLowerCase().trim()
  const items  = document.querySelectorAll('.glossary-item')
  const emptyEl = document.getElementById('glossaryEmpty')
  const queryEl = document.getElementById('glossaryQuery')
  let visible = 0

  items.forEach(item => {
    const term  = item.dataset.term || ''
    const text  = item.textContent.toLowerCase()
    const match = !q || term.includes(q) || text.includes(q)
    item.hidden = !match
    if (match) visible++
  })

  if (emptyEl) {
    emptyEl.hidden = visible > 0
    if (queryEl && visible === 0) queryEl.textContent = esc(query)
  }
}

// ═══════════════════════════════════════════════════
// FASE 7 — FOOTER DINÁMICO
// ═══════════════════════════════════════════════════

function renderFooterRegulators(countries) {
  const container = document.getElementById('footerRegulators')
  if (!container) return
  container.innerHTML = ''
  Object.entries(countries).forEach(([, country]) => {
    const a = document.createElement('a')
    a.href = esc(country.regulator_url)
    a.className = 'regulator-link'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = `Regulado en ${country.name} por ${country.regulator}`
    container.appendChild(a)
  })
}

// ═══════════════════════════════════════════════════
// FASE 8 — COOKIE BANNER
// ═══════════════════════════════════════════════════

function initCookieBanner() {
  const banner    = document.getElementById('cookieBanner')
  const acceptBtn = document.getElementById('cookieAccept')
  const rejectBtn = document.getElementById('cookieReject')
  if (!banner) return

  const consent = localStorage.getItem(COOKIE_KEY)
  if (!consent) {
    banner.hidden = false
  } else if (consent === 'accepted') {
    loadAdScripts()
  }

  acceptBtn?.addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    banner.hidden = true
    loadAdScripts()
  })

  rejectBtn?.addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'rejected')
    banner.hidden = true
  })
}

/** Carga dinámicamente los scripts de publicidad (solo si se aceptó) */
function loadAdScripts() {
  console.debug('[minicreditos.pro] Consentimiento aceptado — anuncios habilitados')
}

// ═══════════════════════════════════════════════════
// FASE 9 — EVENTOS DE UI
// ═══════════════════════════════════════════════════

function bindEvents() {
  // Slider de importe
  const slider = document.getElementById('amountSlider')
  slider?.addEventListener('input', () => {
    appState.activeAmount = sliderToAmount(parseInt(slider.value, 10))
    updateAmountDisplay()
    applyFilters()
  })

  // Botones de plazo
  document.getElementById('plazoBtns')?.addEventListener('click', e => {
    const btn = e.target.closest('.plazo-btn')
    if (!btn || btn.disabled) return
    document.querySelectorAll('.plazo-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    appState.activePlazo = parseInt(btn.dataset.plazo, 10)
    applyFilters()
  })

  // Botones de tipo
  document.getElementById('tipoBtns')?.addEventListener('click', e => {
    const btn = e.target.closest('.tipo-btn')
    if (!btn) return
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    appState.activeTipo = btn.dataset.tipo
    applyFilters()
  })

  // Botón "Ver resultados"
  document.getElementById('btnSearch')?.addEventListener('click', () => {
    const resultsSection = document.getElementById('results')
    resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    applyFilters()
  })

  // Glosario — filtro en tiempo real
  document.getElementById('glossarySearch')?.addEventListener('input', e => {
    filterGlossary(e.target.value)
  })

  // Botones extra (ASNEF, Aval coche)
  document.getElementById('extraBtns')?.addEventListener('click', e => {
    const btn = e.target.closest('.extra-btn')
    if (!btn) return
    const filter = btn.dataset.filter
    const isActive = btn.classList.toggle('active')
    btn.setAttribute('aria-pressed', String(isActive))
    if (filter === 'asnef')       appState.activeAsnef = isActive
    if (filter === 'aval')        appState.activeAvalCoche = isActive
    if (filter === 'sin_nomina')  appState.activeSinNomina = isActive
    if (filter === 'primer_gratis') appState.activePrimerGratis = isActive
    applyFilters()
  })

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle')
  const navLinks  = document.getElementById('navLinks')
  navToggle?.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open')
    navToggle.setAttribute('aria-expanded', String(isOpen))
  })

  // Cerrar nav al hacer click en un enlace
  document.querySelectorAll('#navLinks a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks?.classList.remove('open')
      navToggle?.setAttribute('aria-expanded', 'false')
    })
  })

  // Actualizar etiqueta del filtro ASNEF según el país seleccionado
  document.getElementById('countryTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.country-tab')
    if (!btn) return
    const asnefBtn = document.querySelector('.extra-btn[data-filter="asnef"]')
    if (asnefBtn) {
      asnefBtn.textContent = btn.dataset.country === 'us'
        ? 'Sin historial / ITIN'
        : 'Acepta ASNEF'
    }
  })
}

// ═══════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════

async function init() {
  try {
    // 1. Cargar datos
    const data = await loadData()
    appState.data = data

    const countries = data.countries
    if (!countries || Object.keys(countries).length === 0) {
      throw new Error('No hay países disponibles en los datos.')
    }

    // 2. Crear tabs de país
    initCountryTabs(countries)

    // 3. Renderizar reguladores en el footer
    renderFooterRegulators(countries)

    // 4. Seleccionar país inicial:
    //    a) parámetro ?pais= de la URL
    //    b) primer país del JSON
    const urlCountry  = getCountryFromURL()
    const firstKey    = Object.keys(countries)[0]
    const initialCode = (urlCountry && countries[urlCountry]) ? urlCountry : (countries['co'] ? 'co' : firstKey)

    selectCountry(initialCode)

    appState._initialized = true

    // 5. Registrar eventos
    bindEvents()

    // 6. Cookie banner
    initCookieBanner()

  } catch (err) {
    console.error('[minicreditos.pro] Error al inicializar:', err)

    // Mostrar error de carga al usuario
    const grid = document.getElementById('resultsGrid')
    if (grid) {
      const loading = document.getElementById('resultsLoading')
      if (loading) loading.style.display = 'none'
      const errEl = document.createElement('div')
      errEl.className = 'results-empty'
      errEl.innerHTML = `<strong>No se pudieron cargar los datos</strong>Recarga la página para intentarlo de nuevo.`
      grid.appendChild(errEl)
    }
  }
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
