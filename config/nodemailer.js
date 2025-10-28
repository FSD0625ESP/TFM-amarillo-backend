import nodemailer from "nodemailer";

// ⚙️ Configura el transporte SMTP
export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // por ejemplo: "smtp.gmail.com" o "smtp.office365.com"
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER, // tu dirección de correo
    pass: process.env.EMAIL_PASS, // tu contraseña o token de aplicación
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
