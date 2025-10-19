import mongoose from 'moongoose';
const{Schema} = mongoose;

const adminSchema = new Schema({
    username:{type: String, required: true},
    passwordHash:{type: String, required: true},
    role:{type: String, default: 'admin'}
});

export default mongoose.model('Admin', adminSchema); 