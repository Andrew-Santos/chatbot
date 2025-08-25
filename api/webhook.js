import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase (substitua pelas suas credenciais)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
      console.log("📨 Evento recebido do Meta:", JSON.stringify(req.body, null, 2));
      
      const { entry } = req.body;
      
      if (entry && entry.length > 0) {
        for (const pageEntry of entry) {
          console.log('Page Entry:', pageEntry);
          
          // Processar mensagens do WhatsApp/Messenger
          if (pageEntry.messaging) {
            for (const messagingEvent of pageEntry.messaging) {
              await processMessage(messagingEvent);
            }
          }
          
          // Processar outros tipos de mudanças
          if (pageEntry.changes) {
            for (const change of pageEntry.changes) {
              console.log('Change Event:', change);
              // Aqui você pode processar outros tipos de eventos
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

// Função para processar mensagens e salvar no banco
async function processMessage(messagingEvent) {
  try {
    console.log('🔄 Processando mensagem:', messagingEvent);
    
    // Extrair dados da mensagem
    const senderId = messagingEvent.sender?.id;
    const message = messagingEvent.message?.text || 
                   messagingEvent.message?.attachments?.[0]?.type || 
                   'Mensagem sem texto';
    
    if (!senderId) {
      console.log('❌ Sender ID não encontrado');
      return;
    }

    // 1. Buscar ou criar lead
    let leadId = await findOrCreateLead(senderId);
    
    // 2. Salvar mensagem
    await saveMensagem(leadId, message);
    
    console.log('✅ Mensagem processada com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
}

// Função para buscar ou criar um lead
async function findOrCreateLead(contacts) {
  try {
    // Primeiro, tenta encontrar um lead existente
    const { data: existingLead, error: findError } = await supabase
      .from('leads')
      .select('id')
      .eq('contacts', contacts)
      .eq('status', true)
      .single();
    
    if (existingLead) {
      console.log('📋 Lead existente encontrado:', existingLead.id);
      return existingLead.id;
    }
    
    // Se não encontrou, cria um novo lead
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
      throw createError;
    }
    
    console.log('🆕 Novo lead criado:', newLead.id);
    return newLead.id;
    
  } catch (error) {
    console.error('❌ Erro ao buscar/criar lead:', error);
    throw error;
  }
}

// Função para salvar mensagem
async function saveMensagem(leadId, mensagem) {
  try {
    const { data, error } = await supabase
      .from('mensagem')
      .insert({
        id_lead: leadId,
        remetente: 'client', // Fixo como 'client' conforme solicitado
        mensagem: mensagem,
        criado_em: new Date().toISOString()
      });
    
    if (error) {
      throw error;
    }
    
    console.log('💬 Mensagem salva no banco');
    return data;
    
  } catch (error) {
    console.error('❌ Erro ao salvar mensagem:', error);
    throw error;
  }
}
