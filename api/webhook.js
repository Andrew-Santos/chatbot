export default async function handler(req, res) {
  // Configuração CORS para Meta
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const VERIFY_TOKEN = "awmssantos"; // Token de verificação
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Se não tem parâmetros, é um teste direto no browser
    if (!mode && !token && !challenge) {
      return res.status(200).json({
        status: 'Webhook ativo',
        message: 'Para testar, use: ?hub.mode=subscribe&hub.verify_token=awmssantos&hub.challenge=test',
        timestamp: new Date().toISOString()
      });
    }

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verificado com sucesso!");
      return res.status(200).send(challenge);
    } else {
      console.log("❌ Falha na verificação do webhook");
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Token de verificação inválido'
      });
    }
  } 
  
  else if (req.method === 'POST') {
    try {
      console.log("📨 === WEBHOOK POST RECEBIDO ===");
      console.log("Body completo:", JSON.stringify(req.body, null, 2));
      console.log("================================");
      
      const { entry } = req.body;
      
      if (entry && entry.length > 0) {
        console.log(`🔄 Processando ${entry.length} entries...`);
        
        for (const pageEntry of entry) {
          // Processar webhooks do WhatsApp Business API
          if (pageEntry.changes) {
            console.log(`🔔 Encontradas ${pageEntry.changes.length} mudanças`);
            for (const change of pageEntry.changes) {
              
              // Processar mensagens do WhatsApp Business API
              if (change.field === 'messages' && change.value?.messages) {
                console.log('📱 Processando mensagens do WhatsApp Business API');
                for (const message of change.value.messages) {
                  console.log('📨 Mensagem WA Business:', JSON.stringify(message, null, 2));
                  
                  // Extrair dados da mensagem
                  const senderId = message.from;
                  const messageText = message.text?.body || message.type || 'Mensagem sem texto';
                  
                  console.log(`📱 WhatsApp - De: ${senderId}, Mensagem: "${messageText}"`);
                  
                  // TENTAR SALVAR NO BANCO
                  await tryToSaveToDatabase(senderId, messageText);
                }
              }
            }
          }
        }
      }

      // Sempre retorna 200 para o Meta saber que recebeu
      return res.status(200).json({ 
        success: true, 
        message: 'Evento processado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro ao processar evento:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message
      });
    }
  } 
  
  else {
    res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
      allowed: ["GET", "POST", "OPTIONS"]
    });
  }
}

// Função SIMPLES para tentar salvar no banco
async function tryToSaveToDatabase(senderId, messageText) {
  try {
    console.log('💾 === TENTANDO SALVAR NO BANCO ===');
    console.log('Contato:', senderId);
    console.log('Mensagem:', messageText);
    
    // Verificar se as variáveis de ambiente existem
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Variáveis do Supabase não configuradas.');
      console.log('Configure SUPABASE_URL e SUPABASE_ANON_KEY no Vercel');
      return false;
    }
    
    console.log('✅ Variáveis do Supabase encontradas');
    console.log('URL:', supabaseUrl);
    
    // USAR FETCH DIRETO (mais simples)
    // 1. Buscar lead existente
    console.log('🔍 Buscando lead existente...');
    
    const searchResponse = await fetch(`${supabaseUrl}/rest/v1/leads?contacts=eq.${senderId}&status=eq.true&select=id`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const existingLeads = await searchResponse.json();
    console.log('Leads encontrados:', existingLeads);
    
    let leadId;
    
    if (existingLeads && existingLeads.length > 0) {
      // Lead existente encontrado
      leadId = existingLeads[0].id;
      console.log('📋 Lead existente encontrado:', leadId);
    } else {
      // Criar novo lead
      console.log('🆕 Criando novo lead...');
      
      const createLeadResponse = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id_parceiro: 1,
          contacts: senderId,
          status: true,
          criado_em: new Date().toISOString()
        })
      });
      
      const newLead = await createLeadResponse.json();
      console.log('Resposta criação lead:', newLead);
      
      if (newLead && newLead.length > 0) {
        leadId = newLead[0].id;
        console.log('✅ Novo lead criado:', leadId);
      } else {
        console.log('❌ Erro ao criar lead:', newLead);
        return false;
      }
    }
    
    // 2. Salvar mensagem
    console.log('💬 Salvando mensagem...');
    
    const saveMessageResponse = await fetch(`${supabaseUrl}/rest/v1/mensagem`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id_lead: leadId,
        remetente: 'client',
        mensagem: messageText,
        criado_em: new Date().toISOString()
      })
    });
    
    const savedMessage = await saveMessageResponse.json();
    console.log('Resposta salvar mensagem:', savedMessage);
    
    if (savedMessage && savedMessage.length > 0) {
      console.log('✅ Mensagem salva com sucesso!');
      return true;
    } else {
      console.log('❌ Erro ao salvar mensagem:', savedMessage);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erro geral ao salvar no banco:', error);
    return false;
  }
}
