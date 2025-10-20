import {body} from 'express-validator';

export const adminSchema = [
    body('username').isString().withMessage('Username must be a string').notEmpty().withMessage('Username is required'),
    body('password').isString().withMessage('Password must be a string').isLength({min: 8}).withMessage('Password must be at least 8 characters long'),
];
