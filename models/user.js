const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nome: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    filiacao: { 
        type: String 
    },
    nivel: { 
        type: String, 
        enum: ['administrador', 'produtor', 'consumidor'], 
        default: 'consumidor',
        required: true 
    },
    dataRegisto: { 
        type: Date, 
        default: Date.now 
    },
    dataUltimoAcesso: { 
        type: Date 
    },
    password: { 
        type: String, 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('user', userSchema);