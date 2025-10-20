import { validationResult } from 'express-validator';
import Admin from '../models/admins.js';

// 🔹 Crear admin
export const createAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'El admin ya existe.' });
    }

    const newAdmin = new Admin({
      username,
      passwordHash: password, // texto plano por ahora
      role: 'Admin'
    });

    await newAdmin.save();

    return res.status(201).json({ message: 'Admin creado exitosamente.', admin: newAdmin });
  } catch (error) {
    console.error('❌ Error en createAdmin:', error);
    return res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
};

// 🔹 Login admin
export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ message: 'Admin no encontrado.' });
    }

    if (admin.passwordHash !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    return res.status(200).json({ message: 'Login exitoso.', role: admin.role });
  } catch (error) {
    console.error('❌ Error en loginAdmin:', error);
    return res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
};

// 🔹 Eliminar admin
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Admin.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Admin no encontrado.' });
    }

    return res.status(200).json({ message: 'Admin eliminado correctamente.', deleted });
  } catch (error) {
    console.error('❌ Error en deleteAdmin:', error);
    return res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
};