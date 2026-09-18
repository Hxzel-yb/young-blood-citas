// api/create-checkout-session.js
// api/create-checkout-session.js
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const {
      cliente_nombre,
      whatsapp,
      servicio_id,
      servicio_nombre,
      precio,
      fecha,
      hora
    } = req.body;

    if (!cliente_nombre || !whatsapp || !servicio_nombre || !precio || !fecha || !hora) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const citaRes = await fetch(`${SUPABASE_URL}/rest/v1/citas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{
        cliente_nombre,
        whatsapp,
        servicio_id: servicio_id || null,
        servicio_nombre,
        precio,
        fecha,
        hora,
        estado: 'pendiente_pago'
      }])
    });

    if (!citaRes.ok) {
      const errText = await citaRes.text();
      console.error('Error creando cita:', errText);
      return res.status(500).json({ error: 'No se pudo crear la cita' });
    }

    const [cita] = await citaRes.json();

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: `${servicio_nombre} — ${fecha} ${hora}` },
          unit_amount: Math.round(Number(precio) * 100)
        },
        quantity: 1
      }],
      metadata: {
        cita_id: cita.id
      },
      success_url: `${origin}/?pago=exitoso`,
      cancel_url: `${origin}/?pago=cancelado`
    });

    await fetch(`${SUPABASE_URL}/rest/v1/citas?id=eq.${cita.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stripe_session_id: session.id })
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
