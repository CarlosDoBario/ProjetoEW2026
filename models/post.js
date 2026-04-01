const mongoose = require('mongoose');

const comentarioSchema = new mongoose.Schema({
    autor: { 
        type: String, 
        required: true 
    },
    conteudo: { 
        type: String, 
        required: true 
    },
    data: { 
        type: Date, 
        default: Date.now 
    }
});

const postSchema = new mongoose.Schema({
    recursoId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'recurso', 
        required: true 
    },
    autor: { 
        type: String, 
        required: true 
    },
    titulo: { 
        type: String, 
        required: true 
    },
    conteudo: { 
        type: String, 
        required: true 
    },
    comentarios: [comentarioSchema]
}, { timestamps: true });

module.exports = mongoose.model('post', postSchema);