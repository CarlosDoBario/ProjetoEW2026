const Recurso = require('../models/recurso');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Processo de Ingestão: SIP -> AIP
exports.ingest = async (req, res) => {
    try {
        const zipPath = req.file.path;
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        const manifestEntry = zipEntries.find(e => e.entryName.toLowerCase().includes('manifest'));
        
        if (!manifestEntry) {
            return res.status(400).json({ erro: "Estrutura inválida: Manifesto não encontrado no SIP." });
        }

        const manifestData = JSON.parse(zip.readAsText(manifestEntry));

        // Processo de Administração: Conversão SIP em AIP
        const storageDir = path.join(__dirname, '../uploads/aips/', req.file.filename);
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

        zip.extractAllTo(storageDir, true);

        // Persistência no mongo
        const novoRecurso = new Recurso({
            tipo: manifestData.tipo || "Outro",
            titulo: manifestData.titulo,
            subtitulo: manifestData.subtitulo,
            dataCriacao: manifestData.dataCriacao,
            produtor: req.body.produtor || "Sistema",
            visibilidade: req.body.visibilidade || 'público',
            classificacao: manifestData.hashtags || [],
            caminhoFicheiro: storageDir 
        });

        const guardado = await novoRecurso.save();
        res.status(201).json(guardado);

    } catch (err) {
        res.status(500).json({ erro: "Erro no processo de ingestão: " + err.message });
    }
};

exports.list = () => Recurso.find().sort({ dataRegisto: -1 });
exports.findById = (id) => Recurso.findById(id);
exports.update = (id, data) => Recurso.findByIdAndUpdate(id, data, { new: true });
exports.remove = (id) => Recurso.findByIdAndDelete(id);