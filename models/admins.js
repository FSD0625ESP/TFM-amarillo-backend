import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'Admin' }
});


adminSchema.methods.comparePassword = function(password) {
  return this.passwordHash === password;
};

export default mongoose.model('Admin', adminSchema);