import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'Admin' }
});

adminSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model('Admin', adminSchema);