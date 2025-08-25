export default function handler(req, res) {
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
      
      // Processa os dados recebidos
      const { entry } = req.body;
      
      if (entry && entry.length > 0) {
        entry.forEach(pageEntry => {
          console.log('Page Entry:', pageEntry);
          
          // Aqui você pode processar diferentes tipos de eventos
          if (pageEntry.messaging) {
            pageEntry.messaging.forEach(messagingEvent => {
              console.log('Messaging Event:', messagingEvent);
              // Processar mensagens aqui
            });
          }
          
          if (pageEntry.changes) {
            pageEntry.changes.forEach(change => {
              console.log('Change Event:', change);
              // Processar mudanças aqui
            });
          }
        });
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
