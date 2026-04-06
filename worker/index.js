// worker/index.js
// minicreditos-groq-worker — Proxy para Groq API
// Deploy: wrangler deploy

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const ALLOWED_ORIGINS = [
  'https://minicreditos.pro',
  'https://www.minicreditos.pro',
  'https://minicreditos-pro.pages.dev',
  'http://localhost:8788',
  'http://localhost:3000',
]

// SYSTEM PROMPT — define el comportamiento de la IA
// CRÍTICO: la IA solo informa y educa, nunca recomienda ni asesora
const SYSTEM_PROMPT = `Eres un asistente informativo especializado en educación financiera sobre minicréditos y préstamos rápidos en España y Latinoamérica.

TU ROL:
- Explicar conceptos financieros en lenguaje claro y sencillo
- Describir cómo funcionan los minicréditos, qué es un broker, qué es un prestamista directo
- Explicar qué significan términos como TAE, TIN, ASNEF, plazo, honorarios
- Informar sobre el proceso general de solicitud de préstamos
- Explicar las consecuencias del impago de forma neutral y objetiva
- Adaptar las explicaciones al país del usuario (reguladores, terminología local)

PROHIBICIONES ABSOLUTAS — nunca hagas esto bajo ninguna circunstancia:
- NUNCA digas que un producto o entidad específica es "el mejor", "el más adecuado" o "te recomiendo"
- NUNCA garantices ni insinúes que el usuario será aprobado
- NUNCA compares entidades con superlativos (la más rápida, la más barata)
- NUNCA des cifras exactas de TAE o intereses de entidades concretas como si fueran garantizadas
- NUNCA des asesoramiento financiero personalizado
- NUNCA animes a pedir un préstamo si el usuario no lo ha planteado

CIERRE OBLIGATORIO: Termina SIEMPRE tus respuestas con:
"Recuerda consultar las condiciones actualizadas directamente con el prestamista antes de solicitar cualquier producto financiero."

TONO: Cercano, claro, neutral. Sin tecnicismos innecesarios. Máximo 150 palabras por respuesta.`

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let body
    try { body = await request.json() } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { userMsg, country, amount, plazo } = body
    if (!userMsg || typeof userMsg !== 'string' || userMsg.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Falta userMsg' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sanitizar el mensaje: limitar longitud para evitar abusos
    const safeMsg = userMsg.slice(0, 500)

    // Contexto del filtro actual del usuario para personalizar la respuesta
    const contextMsg = country
      ? `[Contexto: el usuario está buscando en ${country.toUpperCase()}${amount ? `, importe: ${amount}` : ''}${plazo ? `, plazo: ${plazo} días` : ''}] ${safeMsg}`
      : safeMsg

    try {
      const groqRes = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 300,
          temperature: 0.4,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contextMsg }
          ]
        })
      })

      if (!groqRes.ok) {
        const err = await groqRes.text()
        return new Response(JSON.stringify({ error: `Groq error ${groqRes.status}`, detail: err.slice(0, 200) }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await groqRes.json()
      const text = data.choices?.[0]?.message?.content || ''

      return new Response(JSON.stringify({ text }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (e) {
      return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}
