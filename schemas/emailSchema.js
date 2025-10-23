import { body } from 'express-validator';

export const emailSchema = [
  body('email')
    .isEmail()
    .withMessage('Invalid email format'),

  body('name')
    .isString()
    .withMessage('Name must be a string')
    .notEmpty()
    .withMessage('Name is required'),

  body('age')
    .toInt() // 🔥 convierte "25" a 25 antes de validar
    .isInt({ min: 16, max: 130 })
    .withMessage('Age must be a positive integer'),

  body('country')
    .notEmpty()
    .withMessage('Country is required'),

  // (opcional) si tienes checkbox o booleanos:
  body('terms')
    .optional()
    .toBoolean(),

  body('photoYear')
    .optional()
    .toInt()
    .isInt({ min: 1882, max: new Date().getFullYear() })
    .withMessage(`Photo year must be between 1882 and ${new Date().getFullYear()}`),
];
