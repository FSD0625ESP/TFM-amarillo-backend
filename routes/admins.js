import express from 'express';
import { adminSchema } from '../schemas/adminSchema.js';
import { createAdmin, loginAdmin, deleteAdmin 
} from '../controllers/adminController.js';

const router = express.Router();

router.post('/create', adminSchema, createAdmin);
router.post('/login', loginAdmin)
router.delete('/:id', deleteAdmin);

export default router;
