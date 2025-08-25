export default function handler(req, res) {
  if (req.method === 'GET') {
    const VERIFY_TOKEN = "awmssantos"; // mesmo que você colocou no painel

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log("Webhook verificado!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } 
  
  else if (req.method === 'POST') {
    console.log("Evento recebido:", req.body);
    res.status(200).json({ success: true, data: req.body });
  } 
  
  else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
