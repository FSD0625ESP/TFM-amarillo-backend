import mongoose from 'mongoose';
const{Schema} = mongoose;

const emailEntrySchema = new Schema({
    email:{type: String, required: true, unique: true},
    name:{type: String, required: true},
    age: {type: Number, required: true},
    country:{type: String, required: true},
    subscribedAt:{type: Date, default: Date.now},
    verificationCode:{type: String, required: true},
    isVerified:{type: Boolean, default: false}
});

export default mongoose.model('EmailEntry', emailEntrySchema);