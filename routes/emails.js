import express from 'express';
import { emailSchema } from '../schemas/emailSchema.js';
import { sendEmail, getEmail, deleteEmail, verificationCode
} from '../controllers/emailController.js';  


const router = express.Router();


router.post('/send', emailSchema, sendEmail);
router.get('/', getEmail);
router.delete('/:id', deleteEmail);
router.post('/verify', verificationCode);

export default router;