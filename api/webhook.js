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

    // Log detalhado para debug
    console.log('=== DEBUG VERIFICAÇÃO WEBHOOK ===');
    console.log('Query completa recebida:', req.query);
    console.log('Mode recebido:', mode, '(tipo:', typeof mode, ')');
    console.log('Token recebido:', token, '(tipo:', typeof token, ')');
    console.log('Token esperado:', VERIFY_TOKEN, '(tipo:', typeof VERIFY_TOKEN, ')');
    console.log('Challenge:', challenge ? 'presente' : 'ausente');
    console.log('Comparação mode:', mode === 'subscribe');
    console.log('Comparação token:', token === VERIFY_TOKEN);
    console.log('================================');

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
      console.log('Motivo da falha:');
      console.log('- Mode presente:', !!mode);
      console.log('- Token presente:', !!token);
      console.log('- Mode é subscribe:', mode === 'subscribe');
      console.log('- Token confere:', token === VERIFY_TOKEN);
      
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Token de verificação inválido',
        debug: {
          receivedMode: mode,
          receivedToken: token ? 'presente' : 'ausente',
          expectedToken: 'awmssantos'
        }
      });
    }
  } 
  
  else if (req.method === 'POST') {
    try {
      console.log("📨 === WEBHOOK POST RECEBIDO ===");
      console.log("Headers:", req.headers);
      console.log("Body completo:", JSON.stringify(req.body, null, 2));
      console.log("================================");
      
      const { entry } = req.body;
      
      if (entry && entry.length > 0) {
        console.log(`🔄 Processando ${entry.length} entries...`);
        
        for (const pageEntry of entry) {
          console.log('📄 Page Entry completa:', JSON.stringify(pageEntry, null, 2));
          
          // Processar mensagens do WhatsApp/Messenger
          if (pageEntry.messaging) {
            console.log(`💬 Encontradas ${pageEntry.messaging.length} mensagens`);
            for (const messagingEvent of pageEntry.messaging) {
              console.log('📨 Processando mensagem Messenger:', JSON.stringify(messagingEvent, null, 2));
              await processMessengerMessage(messagingEvent);
            }
          } else {
            console.log('❌ Nenhuma mensagem encontrada em pageEntry.messaging');
          }
          
          // Processar webhooks do WhatsApp Business API
          if (pageEntry.changes) {
            console.log(`🔔 Encontradas ${pageEntry.changes.length} mudanças`);
            for (const change of pageEntry.changes) {
              console.log('🔄 Change Event:', JSON.stringify(change, null, 2));
              
              // Processar mensagens do WhatsApp Business API
              if (change.field === 'messages' && change.value?.messages) {
                console.log('📱 Processando mensagens do WhatsApp Business API');
                for (const message of change.value.messages) {
                  console.log('📨 Mensagem WA Business:', JSON.stringify(message, null, 2));
                  await processWhatsAppMessage(message, change.value);
                }
              }
            }
          } else {
            console.log('❌ Nenhuma mudança encontrada em pageEntry.changes');
          }
        }
      } else {
        console.log('❌ Nenhuma entry encontrada no body');
        console.log('Body recebido:', req.body);
      }

      // Sempre retorna 200 para o Meta saber que recebeu
      return res.status(200).json({ 
        success: true, 
        message: 'Evento processado com sucesso',
        timestamp: new Date().toISOString(),
        received: !!req.body,
        entries: entry?.length || 0
      });
      
    } catch (error) {
      console.error('❌ Erro ao processar evento:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack 
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

// Função para processar mensagens do Messenger
async function processMessengerMessage(messagingEvent) {
  try {
    console.log('🔄 Processando mensagem Messenger:', messagingEvent);
    
    // Extrair dados da mensagem
    const senderId = messagingEvent.sender?.id;
    const messageText = messagingEvent.message?.text || 
                       messagingEvent.message?.attachments?.[0]?.type || 
                       'Mensagem sem texto';
    
    if (!senderId) {
      console.log('❌ Sender ID não encontrado');
      return;
    }

    console.log(`💬 Messenger - De: ${senderId}, Mensagem: "${messageText}"`);

    // Por enquanto só logamos - depois vamos salvar no banco
    await saveToDatabase(senderId, messageText, 'messenger');
    
    console.log('✅ Mensagem Messenger processada com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao processar mensagem Messenger:', error);
  }
}

// Função para processar mensagens do WhatsApp Business API
async function processWhatsAppMessage(message, value) {
  try {
    console.log('🔄 Processando mensagem WhatsApp Business:', message);
    
    // Extrair dados da mensagem
    const senderId = message.from;
    const messageText = message.text?.body || 
                       message.type || 
                       'Mensagem sem texto';
    
    if (!senderId) {
      console.log('❌ Sender ID não encontrado');
      return;
    }

    console.log(`📱 WhatsApp - De: ${senderId}, Mensagem: "${messageText}"`);

    // Por enquanto só logamos - depois vamos salvar no banco
    await saveToDatabase(senderId, messageText, 'whatsapp');
    
    console.log('✅ Mensagem WhatsApp processada com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao processar mensagem WhatsApp:', error);
  }
}

// Função temporária para simular salvamento no banco
async function saveToDatabase(senderId, messageText, platform) {
  try {
    console.log('💾 === SALVANDO NO BANCO DE DADOS ===');
    console.log('Plataforma:', platform);
    console.log('Sender ID (contacts):', senderId);
    console.log('Mensagem:', messageText);
    console.log('Timestamp:', new Date().toISOString());
    
    // Verificar se as variáveis de ambiente existem
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Variáveis do Supabase não configuradas. Configure SUPABASE_URL e SUPABASE_ANON_KEY');
      return;
    }
    
    // Importar Supabase usando CDN se não estiver disponível via npm
    let supabase;
    try {
      // Tentar importar via npm primeiro
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Conexão com Supabase estabelecida via NPM');
    } catch (importError) {
      try {
        // Se não conseguir via npm, tentar usar fetch diretamente
        console.log('⚠️ Usando conexão direta com Supabase via fetch');
        supabase = {
          from: (table) => ({
            select: (columns = '*') => ({
              eq: (column, value) => ({
                maybeSingle: async () => {
                  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}&select=${columns}`, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  const data = await response.json();
                  return { data: data.length > 0 ? data[0] : null, error: null };
                },
                single: async () => {
                  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}&select=${columns}`, {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  const data = await response.json();
                  return { data: data[0] || null, error: data.length === 0 ? 'No data' : null };
                }
              })
            }),
            insert: (data) => ({
              select: (columns = '*') => ({
                single: async () => {
                  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                    method: 'POST',
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(data)
                  });
                  const result = await response.json();
                  return { data: result[0] || null, error: !response.ok ? result : null };
                }
              }),
              select: async (columns = '*') => {
                const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                  method: 'POST',
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  },
                  body: JSON.stringify(data)
                });
                const result = await response.json();
                return { data: result, error: !response.ok ? result : null };
              }
            })
          })
        };
      } catch (fetchError) {
        console.log('❌ Erro ao conectar com Supabase:', fetchError);
        return;
      }
    }
    
    // 1. Buscar ou criar lead
    const leadId = await findOrCreateLead(supabase, senderId);
    
    // 2. Salvar mensagem
    await saveMensagem(supabase, leadId, messageText);
    
    console.log('✅ Dados salvos no banco com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao salvar no banco:', error);
  }
}

// Função para buscar ou criar um lead
async function findOrCreateLead(supabase, contacts) {
  try {
    console.log('🔍 Buscando lead ativo para contato:', contacts);
    
    // Primeiro, busca por um lead ativo (status=true)
    const { data: activeLead, error: findActiveError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('contacts', contacts)
      .eq('status', true)
      .maybeSingle();
    
    if (findActiveError) {
      console.log('❌ Erro ao buscar lead ativo:', findActiveError);
    }
    
    if (activeLead) {
      console.log('📋 Lead ativo encontrado:', activeLead.id);
      return activeLead.id;
    }
    
    // Se não encontrou lead ativo, verifica se existe algum lead encerrado
    const { data: inactiveLead, error: findInactiveError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('contacts', contacts)
      .eq('status', false)
      .maybeSingle();
    
    if (findInactiveError) {
      console.log('❌ Erro ao buscar lead inativo:', findInactiveError);
    }
    
    if (inactiveLead) {
      console.log('🔒 Lead encerrado encontrado para este contato. Criando novo lead...');
    } else {
      console.log('👤 Primeiro contato deste número. Criando novo lead...');
    }
    
    // Cria um novo lead (seja primeiro contato ou reativação)
    const { data: newLead, error: createError } = await supabase
      .from('leads')
      .insert({
        id_parceiro: 1, // Fixo como 1 conforme solicitado
        contacts: contacts,
        status: true,
        criado_em: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (createError) {
      console.log('❌ Erro ao criar lead:', createError);
      throw createError;
    }
    
    console.log('🆕 Novo lead criado:', newLead.id);
    return newLead.id;
    
  } catch (error) {
    console.error('❌ Erro geral ao buscar/criar lead:', error);
    throw error;
  }
}

// Função para salvar mensagem
async function saveMensagem(supabase, leadId, mensagem) {
  try {
    console.log('💬 Salvando mensagem para lead ID:', leadId);
    
    const { data, error } = await supabase
      .from('mensagem')
      .insert({
        id_lead: leadId,
        remetente: 'client', // Fixo como 'client' conforme solicitado
        mensagem: mensagem,
        criado_em: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.log('❌ Erro ao salvar mensagem:', error);
      throw error;
    }
    
    console.log('💬 Mensagem salva no banco com sucesso:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Erro geral ao salvar mensagem:', error);
    throw error;
  }
}
