import {body} from 'express-validator';

export const emailSchema = [
    body('email').isEmail().withMessage('Invalid email format'),
    body('name').isString().withMessage('Name must be a string').notEmpty().withMessage('Name is required'),
    body('age').isInt({min: 16, max:130}).withMessage('Age must be a positive integer'),
    body('country').notEmpty().withMessage('Country is required')
];
