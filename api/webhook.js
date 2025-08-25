export default async function handler(req, res) {
  if (req.method === "GET") {
    // Verificação de webhook (Meta/Facebook)
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  if (req.method === "POST") {
    try {
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const messages = changes?.messages;

      if (messages) {
        const msg = messages[0];
        const from = msg.from; // número do cliente

        // Salvar no Supabase
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
          method: "POST",
          headers: {
            "apikey": process.env.SUPABASE_KEY,
            "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            contacts: from,
            status: true
          })
        });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Erro no webhook:", err);
      return res.sendStatus(500);
    }
  }

  return res.sendStatus(405);
}
