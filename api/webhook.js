# Guia: Conectando Webhook WhatsApp com Supabase

## 1. Verificação das Variáveis de Ambiente

Primeiro, certifique-se de que as variáveis estão configuradas no Vercel:

### No painel do Vercel:
1. Vá para seu projeto
2. Clique em **Settings** → **Environment Variables**
3. Adicione:
   - `SUPABASE_URL`: https://sdtujifxjivpvqmksrrj.supabase.co
   - `SUPABASE_ANON_KEY`: ey.JhbGc... (sua chave completa)

## 2. Estrutura do Banco de Dados

Verifique se suas tabelas no Supabase estão configuradas corretamente:

### Tabela `leads`:
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  id_parceiro INTEGER NOT NULL,
  contacts TEXT NOT NULL,
  status BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

### Tabela `mensagem`:
```sql
CREATE TABLE mensagem (
  id SERIAL PRIMARY KEY,
  id_lead INTEGER REFERENCES leads(id),
  remetente TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

## 3. Configuração de Políticas RLS (Row Level Security)

No Supabase SQL Editor, execute:

```sql
-- Habilitar RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagem ENABLE ROW LEVEL SECURITY;

-- Política para permitir operações com a chave anônima
CREATE POLICY "Enable all operations for service role" ON leads
FOR ALL USING (true);

CREATE POLICY "Enable all operations for service role" ON mensagem
FOR ALL USING (true);
```

## 4. Código do Webhook Otimizado

Aqui está uma versão melhorada do seu webhook:

```javascript
export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
                  const senderId = message.from;
                  const messageText = message.text?.body || `Mensagem ${message.type}`;
                  
                  console.log(`📱 Nova mensagem de ${senderId}: ${messageText}`);
                  
                  await saveToDatabase(senderId, messageText);
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

// Função melhorada para salvar no banco
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

    // 1. Buscar lead existente
    const searchUrl = `${supabaseUrl}/rest/v1/leads?contacts=eq.${encodeURIComponent(senderId)}&status=eq.true&select=id`;
    
    console.log('🔍 Buscando lead:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, { headers });
    
    if (!searchResponse.ok) {
      throw new Error(`Erro ao buscar lead: ${searchResponse.status}`);
    }
    
    const existingLeads = await searchResponse.json();
    let leadId;

    if (existingLeads?.length > 0) {
      leadId = existingLeads[0].id;
      console.log('📋 Lead existente:', leadId);
    } else {
      // 2. Criar novo lead
      console.log('🆕 Criando novo lead...');
      
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
        throw new Error(`Erro ao criar lead: ${createResponse.status}`);
      }

      const newLead = await createResponse.json();
      leadId = newLead[0]?.id;
      
      if (!leadId) {
        throw new Error('Lead não foi criado');
      }
      
      console.log('✅ Novo lead criado:', leadId);
    }

    // 3. Salvar mensagem
    console.log('💬 Salvando mensagem...');
    
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
      throw new Error(`Erro ao salvar mensagem: ${messageResponse.status}`);
    }

    const savedMessage = await messageResponse.json();
    console.log('✅ Mensagem salva:', savedMessage[0]?.id);
    
    return true;

  } catch (error) {
    console.error('❌ Erro ao salvar:', error);
    return false;
  }
}
```

## 5. Testes

### Teste 1 - Verificação do Webhook:
```bash
curl "https://seu-webhook.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=awmssantos&hub.challenge=test"
```

### Teste 2 - Teste de Conexão com DB:
Crie um arquivo `/api/test-db.js`:

```javascript
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Variáveis não configuradas' });
    }

    // Teste de conexão
    const response = await fetch(`${supabaseUrl}/rest/v1/leads?limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({ 
        success: true, 
        message: 'Conexão OK',
        sample: data 
      });
    } else {
      return res.status(500).json({ 
        error: 'Erro na conexão',
        status: response.status 
      });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
