import Brevo from "@getbrevo/brevo";
import dotenv from "dotenv";

dotenv.config();

const brevo = new Brevo.TransactionalEmailsApi();

// 🔑 ESTA LÍNEA ES LA CLAVE DE TODO
brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export default brevo;
