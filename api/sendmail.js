import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { name, email, message } = req.body;

    try {
      const API_KEY = process.env.ZOHO_API_KEY;  // добавь в Vercel Settings → Environment Variables

      const response = await fetch("https://api.zeptomail.com/v1.1/email", {
        method: "POST",
        headers: {
          "Authorization": `Zoho-enczapikey ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: { address: "yourmail@domain.com", name: "Website" },
          to: [{ email_address: { address: "yourmail@domain.com" } }],
          subject: "Новое сообщение с сайта",
          htmlbody: `
            <b>Имя:</b> ${name} <br>
            <b>Email:</b> ${email} <br>
            <b>Сообщение:</b><br>${message}
          `
        })
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.statusText}`);
      }

      res.status(200).json({ success: true, message: "Сообщение отправлено!" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  } else {
    res.status(405).json({ message: "Метод не разрешён" });
  }
}
