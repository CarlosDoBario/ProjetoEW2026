const mongoose = require('mongoose');

const recursoSchema = new mongoose.Schema({
    tipo: { 
        type: String, 
        required: true 
    },
    titulo: { 
        type: String, 
        required: true 
    },
    subtitulo: { 
        type: String 
    },
    dataCriacao: { 
        type: Date 
    },
    dataRegisto: { 
        type: Date, 
        default: Date.now 
    },
    visibilidade: { 
        type: String, 
        enum: ['público', 'privado'], 
        default: 'público' 
    },
    produtor: { 
        type: String, 
        required: true 
    },
    classificacao: [{ 
        type: String 
    }],
    downloads: { type: Number, default: 0 },
    ranking: {
        somaEstrelas: { type: Number, default: 0 },
        numVotos: { type: Number, default: 0 }
    },
    caminhoFicheiro: { 
        type: String 
    }
}, { timestamps: true });

module.exports = mongoose.model('recurso', recursoSchema);