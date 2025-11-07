import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🔍 Verifica que la conexión funcione al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Error al conectar con el servidor SMTP:", error);
  } else {
    console.log("✅ Servidor de correo listo para enviar mensajes");
  }
});