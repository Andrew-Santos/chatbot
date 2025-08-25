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
