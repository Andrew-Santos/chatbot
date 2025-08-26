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
    const VERIFY_TOKEN = "awmssantos";
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
                  // 🔹 CORREÇÃO: Verificar se não é uma mensagem enviada pelo bot
                  if (change.value?.metadata?.phone_number_id === message.from) {
                    console.log("🤖 Mensagem enviada pelo bot, ignorando...");
                    continue;
                  }

                  const senderId = message.from;
                  let messageText = '';
                  let isInteractiveResponse = false;

                  // 🔹 Verificar tipo de mensagem
                  if (message.type === 'text') {
                    messageText = message.text?.body || 'Mensagem de texto';
                  } else if (message.type === 'interactive') {
                    // Resposta de lista interativa
                    if (message.interactive?.type === 'list_reply') {
                      const selectedOption = message.interactive.list_reply;
                      messageText = `Selecionou: ${selectedOption.title}`;
                      isInteractiveResponse = true;
                      console.log('📋 Opção selecionada:', selectedOption);
                    } else if (message.interactive?.type === 'button_reply') {
                      const selectedButton = message.interactive.button_reply;
                      messageText = `Clicou: ${selectedButton.title}`;
                      isInteractiveResponse = true;
                      console.log('🔘 Botão clicado:', selectedButton);
                    }
                  } else {
                    messageText = `Mensagem ${message.type}`;
                  }

                  console.log(`📱 Nova mensagem de ${senderId}: ${messageText}${isInteractiveResponse ? ' (interativa)' : ''}`);

                  // 1. Salvar mensagem recebida no Supabase
                  const saved = await saveToDatabase(senderId, messageText);
                  
                  if (saved && !isInteractiveResponse) {
                    // 2. Responder com fluxo inicial (apenas para mensagens de texto normais)
                    await sendFlowMessage(senderId);
                  } else if (saved && isInteractiveResponse) {
                    // 3. Processar resposta interativa (você pode implementar lógica específica aqui)
                    await handleInteractiveResponse(senderId, message.interactive);
                  }
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

    console.log('🔍 Salvando no banco:', senderId, messageText);

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 🔎 Buscar lead existente
    const searchUrl = `${supabaseUrl}/rest/v1/leads?contacts=eq.${encodeURIComponent(senderId)}&status=eq.true&select=id`;

    const searchResponse = await fetch(searchUrl, { headers });
    if (!searchResponse.ok) {
      console.error('❌ Erro ao buscar lead:', searchResponse.status);
      return false;
    }

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

      if (!createResponse.ok) {
        console.error('❌ Erro ao criar lead:', createResponse.status);
        return false;
      }
      
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

    if (!messageResponse.ok) {
      console.error('❌ Erro ao salvar mensagem:', messageResponse.status);
      return false;
    }
    
    const savedMessage = await messageResponse.json();
    console.log('✅ Mensagem salva:', savedMessage[0]?.id);

    return true;

  } catch (error) {
    console.error('❌ Erro ao salvar no Supabase:', error);
    return false;
  }
}

/* ============================================================
   🔹 Função para processar respostas interativas
   ============================================================ */
async function handleInteractiveResponse(senderId, interactive) {
  try {
    console.log('🎯 Processando resposta interativa para:', senderId);
    
    if (interactive.type === 'list_reply') {
      const selectedOption = interactive.list_reply;
      const optionId = selectedOption.id; // exemplo: "option_2"
      
      console.log('📋 Usuário selecionou:', selectedOption.title, 'ID:', optionId);
      
      // Aqui você pode implementar a lógica para cada opção
      // Por exemplo, buscar próximo fluxo baseado na opção selecionada
      
      // Enviar confirmação
      await sendSimpleMessage(senderId, `✅ Você selecionou: ${selectedOption.title}\n\nEm breve nossa equipe entrará em contato!`);
      
    } else if (interactive.type === 'button_reply') {
      const selectedButton = interactive.button_reply;
      console.log('🔘 Usuário clicou:', selectedButton.title);
      
      await sendSimpleMessage(senderId, `✅ Opção confirmada: ${selectedButton.title}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar resposta interativa:', error);
  }
}

/* ============================================================
   🔹 Função para enviar mensagem de texto simples
   ============================================================ */
async function sendSimpleMessage(senderId, messageText) {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    const whatsappToken = process.env.WHATSAPP_TOKEN;

    if (!phoneNumberId || !whatsappToken) {
      console.error('⚠️ Variáveis do WhatsApp não encontradas');
      return false;
    }

    const whatsappUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: senderId,
      type: "text",
      text: { body: messageText }
    };

    const response = await fetch(whatsappUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('❌ Erro ao enviar mensagem simples:', response.status);
      return false;
    }

    console.log('✅ Mensagem simples enviada');
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem simples:', error);
    return false;
  }
}
async function sendFlowMessage(senderId) {
  try {
    console.log('🚀 Iniciando envio do fluxo para:', senderId);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('⚠️ Variáveis do Supabase não encontradas para envio');
      return false;
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    // 1. Buscar mensagem inicial (type=title)
    console.log('🔍 Buscando mensagem título...');
    const titleUrl = `${supabaseUrl}/rest/v1/flow_option?type=eq.title&order=ordem.asc&limit=1`;
    const titleResponse = await fetch(titleUrl, { headers });
    
    if (!titleResponse.ok) {
      console.error('❌ Erro ao buscar título:', titleResponse.status);
      return false;
    }
    
    const titleData = await titleResponse.json();
    console.log('📋 Dados do título:', titleData);

    if (!titleData?.length) {
      console.error('❌ Nenhuma mensagem de título encontrada');
      return false;
    }

    const welcome = titleData[0];

    // 2. Buscar opções (type=option) - CORREÇÃO: buscar por type, não por id_parent
    console.log('🔍 Buscando opções...');
    const optionsUrl = `${supabaseUrl}/rest/v1/flow_option?type=eq.option&order=ordem.asc`;
    const optionsResponse = await fetch(optionsUrl, { headers });
    
    if (!optionsResponse.ok) {
      console.error('❌ Erro ao buscar opções:', optionsResponse.status);
      return false;
    }
    
    const options = await optionsResponse.json();
    console.log('📋 Opções encontradas:', options);

    if (!options?.length) {
      console.error('❌ Nenhuma opção encontrada');
      return false;
    }

    // 3. Verificar variáveis do WhatsApp
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    const whatsappToken = process.env.WHATSAPP_TOKEN;

    if (!phoneNumberId || !whatsappToken) {
      console.error('⚠️ Variáveis do WhatsApp não encontradas');
      console.log('PHONE_NUMBER_ID:', phoneNumberId ? 'OK' : 'MISSING');
      console.log('WHATSAPP_TOKEN:', whatsappToken ? 'OK' : 'MISSING');
      return false;
    }

    // 4. Enviar pelo WhatsApp Cloud API com Lista Interativa
    console.log('📤 Enviando lista interativa via WhatsApp API...');
    const whatsappUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    
    // Preparar opções para a lista
    const listOptions = options.map((opt, i) => ({
      id: `option_${opt.id}`,
      title: opt.message.substring(0, 24), // WhatsApp limita a 24 caracteres
      description: opt.message.length > 24 ? opt.message.substring(24, 72) : undefined // Descrição opcional até 72 chars
    }));

    const whatsappPayload = {
      messaging_product: "whatsapp",
      to: senderId,
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: "✔️ Matriz Class Jurídico"
        },
        body: {
          text: welcome.message
        },
        footer: {
          text: "Selecione uma opção abaixo 👇"
        },
        action: {
          button: "Ver Opções",
          sections: [
            {
              title: "Menu Principal",
              rows: listOptions
            }
          ]
        }
      }
    };

    console.log('🔗 URL:', whatsappUrl);
    console.log('📦 Payload:', JSON.stringify(whatsappPayload, null, 2));

    const whatsappResponse = await fetch(whatsappUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(whatsappPayload)
    });

    const responseText = await whatsappResponse.text();
    console.log('📥 Resposta WhatsApp:', whatsappResponse.status, responseText);

    if (!whatsappResponse.ok) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappResponse.status, responseText);
      return false;
    }

    console.log("✅ Fluxo enviado com sucesso para", senderId);
    return true;

  } catch (error) {
    console.error("❌ Erro ao enviar fluxo:", error);
    return false;
  }
}

