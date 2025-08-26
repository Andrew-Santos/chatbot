export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🔹 Validação do Webhook do Meta
  if (req.method === 'GET') {
    const VERIFY_TOKEN = "awmssantos"; // coloque o mesmo token configurado no Meta
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

    if (!mode && !token && !challenge) {
      return res.status(200).json({
        status: 'Webhook ativo',
        message: 'Webhook funcionando',
        timestamp: new Date().toISOString()
      });
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verificado!");
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ error: 'Token inválido' });
  }

  // 🔹 Recebe mensagens enviadas pelo usuário
  if (req.method === 'POST') {
    try {
      console.log("📨 Webhook recebido:", JSON.stringify(req.body, null, 2));

      const { entry } = req.body;

      if (entry?.length > 0) {
        for (const pageEntry of entry) {
          if (pageEntry.changes) {
            for (const change of pageEntry.changes) {
              if (change.field === 'messages' && change.value?.messages) {
                for (const message of change.value.messages) {
                  const senderId = message.from; // número do usuário
                  const messageText = message.text?.body || `Mensagem ${message.type}`;

                  console.log(`📱 Nova mensagem de ${senderId}: ${messageText}`);

                  // 1. Salvar mensagem recebida no Supabase
                  await saveToDatabase(senderId, messageText);

                  // 2. Responder com fluxo inicial
                  await sendFlowMessage(senderId);
                }
              }
            }
          }
        }
      }

      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('❌ Erro:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/* ============================================================
   🔹 Função para salvar a mensagem recebida no Supabase
   ============================================================ */
async function saveToDatabase(senderId, messageText) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Variáveis do Supabase não encontradas');
      return false;
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 🔎 Buscar lead existente
    const searchUrl = `${supabaseUrl}/rest/v1/leads?contacts=eq.${encodeURIComponent(senderId)}&status=eq.true&select=id`;

    const searchResponse = await fetch(searchUrl, { headers });
    if (!searchResponse.ok) throw new Error(`Erro ao buscar lead: ${searchResponse.status}`);

    const existingLeads = await searchResponse.json();
    let leadId;

    if (existingLeads?.length > 0) {
      leadId = existingLeads[0].id;
      console.log('📋 Lead existente:', leadId);
    } else {
      // 🆕 Criar novo lead
      const createResponse = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          id_parceiro: 1,
          contacts: senderId,
          status: true
        })
      });

      if (!createResponse.ok) throw new Error(`Erro ao criar lead: ${createResponse.status}`);
      const newLead = await createResponse.json();
      leadId = newLead[0]?.id;

      console.log('✅ Novo lead criado:', leadId);
    }

    // 💬 Salvar mensagem
    const messageResponse = await fetch(`${supabaseUrl}/rest/v1/mensagem`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        id_lead: leadId,
        remetente: 'client',
        mensagem: messageText
      })
    });

    if (!messageResponse.ok) throw new Error(`Erro ao salvar mensagem: ${messageResponse.status}`);
    const savedMessage = await messageResponse.json();
    console.log('✅ Mensagem salva:', savedMessage[0]?.id);

    return true;

  } catch (error) {
    console.error('❌ Erro ao salvar no Supabase:', error);
    return false;
  }
}

/* ============================================================
   🔹 Função para buscar o fluxo inicial e enviar no WhatsApp
   ============================================================ */
async function sendFlowMessage(senderId) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 1. Buscar mensagem inicial (type=title)
    const resp = await fetch(`${supabaseUrl}/rest/v1/flow_option?type=eq.title&order=ordem.asc&limit=1`, { headers });
    const data = await resp.json();

    if (data?.length > 0) {
      const welcome = data[0];
      let finalMessage = welcome.message + "\n\n";

      // 2. Buscar opções vinculadas (id_parent = id do título)
      const respOpt = await fetch(`${supabaseUrl}/rest/v1/flow_option?id_parent=eq.${welcome.id}&order=ordem.asc`, { headers });
      const options = await respOpt.json();

      if (options?.length) {
        options.forEach((opt, i) => {
          finalMessage += `${i + 1}. ${opt.message}\n`;
        });
      }

      // 3. Enviar pelo WhatsApp Cloud API
      await fetch(`https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: senderId,
          type: "text",
          text: { body: finalMessage }
        })
      });

      console.log("✅ Fluxo enviado para", senderId);
    }
  } catch (error) {
    console.error("❌ Erro ao enviar fluxo:", error);
  }
}
