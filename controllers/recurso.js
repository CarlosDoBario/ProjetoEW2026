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
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            return res.status(400).json({ erro: "Manifesto não encontrado no SIP." });
        }

        const manifestData = JSON.parse(zip.readAsText(manifestEntry));
        const storageDir = path.join(__dirname, '../uploads/aips/', req.file.filename);
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

        zip.extractAllTo(storageDir, true);

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
        res.status(500).json({ erro: "Erro na ingestão: " + err.message });
    }
};

exports.avaliar = (id, nota) => {
    return Recurso.findByIdAndUpdate(
        id,
        { $inc: { "ranking.somaEstrelas": nota, "ranking.numVotos": 1 } },
        { new: true }
    );
};

exports.incrementarDownloads = (id) => {
    return Recurso.findByIdAndUpdate(
        id,
        { $inc: { downloads: 1 } },
        { new: true }
    );
};

// Retorna os 3 recursos mais recentes (últimos 7 dias)
exports.getRecentes = () => {
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
    return Recurso.find({ dataRegisto: { $gte: umaSemanaAtras } })
                  .sort({ dataRegisto: -1 })
                  .limit(3);
};

// Retorna os 5 recursos com melhor ranking (baseado na soma de estrelas)
exports.getTopRated = () => {
    return Recurso.find()
                  .sort({ "ranking.somaEstrelas": -1, "ranking.numVotos": -1 })
                  .limit(5);
};

exports.list = () => Recurso.find().sort({ dataRegisto: -1 });
exports.findById = (id) => Recurso.findById(id);
exports.update = (id, data) => Recurso.findByIdAndUpdate(id, data, { new: true });
exports.remove = (id) => Recurso.findByIdAndDelete(id);