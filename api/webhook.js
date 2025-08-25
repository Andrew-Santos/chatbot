export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("Webhook OK ✅");
  }
  if (req.method === "POST") {
    console.log("Body recebido:", req.body);
    return res.status(200).json({ success: true, data: req.body });
  }
  return res.status(405).end(); // Method Not Allowed
}
