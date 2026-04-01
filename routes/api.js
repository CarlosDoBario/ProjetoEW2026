const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const Recurso = require('../models/recurso');
const Post = require('../models/post');
const User = require('../controllers/user');

const secret = "EngWeb2026_Projeto_Secret";
const upload = multer({ dest: 'uploads/sips/' });

router.post('/usuarios/login', (req, res) => {
    User.consultarPorEmail(req.body.email)
        .then(dados => {
            if (dados && dados.password === req.body.password) {
                const token = jwt.sign({ 
                    nome: dados.nome, 
                    nivel: dados.nivel,
                    email: dados.email,
                    id: dados._id
                }, secret, { expiresIn: '1h' });
                res.status(200).json({ token: token });
            } else {
                res.status(401).json({ mensagem: "Credenciais inválidas" });
            }
        })
        .catch(e => res.status(500).json({ erro: e.message }));
});

router.post('/usuarios/registo', (req, res) => {
    User.inserir(req.body)
        .then(dados => res.status(201).json(dados))
        .catch(e => res.status(500).json({ erro: e.message }));
});

// --- RECURSOS ---

router.get('/recursos', async (req, res) => {
    try {
        const recursos = await Recurso.find().sort({ dataRegisto: -1 });
        res.json(recursos);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.post('/recursos', upload.single('recursoZip'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ erro: 'Ficheiro ZIP não recebido.' });

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();
        const manifestEntry = zipEntries.find(e => e.entryName.toLowerCase().includes('manifest'));

        if (!manifestEntry) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: 'SIP inválido: Manifesto não encontrado.' });
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
            produtor: req.body.produtor || "Anónimo",
            visibilidade: req.body.visibilidade || 'público',
            classificacao: manifestData.hashtags || [],
            caminhoFicheiro: storageDir 
        });

        const guardado = await novoRecurso.save();
        res.status(201).json(guardado);
    } catch (err) {
        res.status(500).json({ erro: "Erro na ingestão: " + err.message });
    }
});

router.get('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ mensagem: "Recurso não encontrado" });
        const posts = await Post.find({ recursoId: req.params.id }).sort({ createdAt: -1 });
        res.json({ ...recurso._doc, posts: posts });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.delete('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (recurso && recurso.caminhoFicheiro) {
            fs.rmSync(recurso.caminhoFicheiro, { recursive: true, force: true });
        }
        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Recurso eliminado.' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.get('/recursos/:id/download', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        const zip = new AdmZip();
        zip.addLocalFolder(recurso.caminhoFicheiro);
        const zipBuffer = zip.toBuffer();
        
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${recurso.titulo.replace(/\s/g, '_')}.zip"`);
        res.send(zipBuffer);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// --- SOCIAL ---

router.post('/recursos/:id/posts', (req, res) => {
    const novoPost = new Post({
        recursoId: req.params.id,
        autor: req.body.autor,
        titulo: req.body.titulo,
        conteudo: req.body.conteudo
    });
    novoPost.save()
        .then(dados => res.status(201).json(dados))
        .catch(err => res.status(500).json({ erro: err.message }));
});

module.exports = router;