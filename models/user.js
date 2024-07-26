const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const UserSchema = new Schema({
    
    fullname:{
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    updatedAt: {
        type: Date,
        default: Date.now()
    }
})
UserSchema.methods.isValidPassword = function (password) {
    // Simple password validation, you can replace it with your own logic
    return this.password === password;
};

const User = mongoose.model('User', UserSchema);

module.exports=User