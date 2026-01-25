import axios from "axios";

export const sendBrevoEmail = async ({ to, subject, html }) => {
  if (!html || typeof html !== "string") {
    throw new Error("HTML inválido para Brevo");
  }

  await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: "Equipo Amarillo",
        email: process.env.EMAIL_FROM,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );
};
