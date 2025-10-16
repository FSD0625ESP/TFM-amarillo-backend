// index.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

// Rutas
import emailRoutes from './routes/emails.js';
// (Puedes agregar más rutas aquí: factsRoutes, uploadRoutes, etc.)

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch((err) => console.error('❌ Error de conexión:', err));

// Rutas
app.use('/emails', emailRoutes);
// Ejemplo: POST /emails/send, GET /emails/get, etc.

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});


app.get('/ping', (req, res) => {
  res.send('Servidor activo 🚀');
});