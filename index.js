require('dotenv').config();

const express = require('express');
const app = express();

const port = process.env.PORT;
const mongoUri = process.env.MONGO_URI;

app.get('/', (req, res) => {
  res.send(`Puerto: ${port} | Mongo URI: ${mongoUri}`);
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});

console.log(process.env.MONGO_URI)