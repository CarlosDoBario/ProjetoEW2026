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
const PostController = require('../controllers/post');
const RecursoController = require('../controllers/recurso');

const secret = "EngWeb2026_Projeto_Secret";
const upload = multer({ dest: 'uploads/sips/' });

function verificaToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ erro: "Token em falta." });

    jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ erro: "Token inválido ou expirado." });
        req.user = user; 
        next();
    });
}

router.get('/usuarios/:id', async (req, res) => {
    try {
        const user = await User.consultar(req.params.id);
        if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
        const { password, ...dados } = user._doc;
        res.json(dados);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.patch('/usuarios/:id/password', async (req, res) => {
    try {
        const user = await User.consultar(req.params.id);
        if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
        if (user.password !== req.body.passwordAtual)
            return res.status(403).json({ erro: "Password atual incorreta." });
        await User.atualizar(req.params.id, { password: req.body.passwordNova });
        res.json({ mensagem: "Password atualizada com sucesso." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/usuarios/login', (req, res) => {
    User.consultarPorEmail(req.body.email).then(dados => {
        if (dados && dados.password === req.body.password) {
            const token = jwt.sign({ nome: dados.nome, nivel: dados.nivel, email: dados.email, id: dados._id }, secret, { expiresIn: '1h' });
            res.status(200).json({ token: token });
        } else { res.status(401).json({ mensagem: "Credenciais inválidas" }); }
    }).catch(e => res.status(500).json({ erro: e.message }));
});

router.post('/usuarios/registo', (req, res) => {
    User.inserir(req.body).then(dados => res.status(201).json(dados)).catch(e => res.status(500).json({ erro: e.message }));
});

router.get('/recursos', async (req, res) => {
    try {
        let query = {};
        
        if (req.query.search) {
            query = { titulo: { $regex: req.query.search, $options: 'i' } };
        }
        
        const recursos = await Recurso.find(query).sort({ dataRegisto: -1 });
        res.json(recursos);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/recursos', upload.single('recursoZip'), RecursoController.ingest);

router.get('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        const posts = await Post.find({ recursoId: req.params.id }).sort({ createdAt: -1 });
        res.json({ ...recurso._doc, posts: posts });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (recurso && recurso.caminhoFicheiro) fs.rmSync(recurso.caminhoFicheiro, { recursive: true, force: true });
        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Recurso eliminado.' });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/recursos/:id/download', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        const zip = new AdmZip();
        zip.addLocalFolder(recurso.caminhoFicheiro);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${recurso.titulo.replace(/\s/g, '_')}.zip"`);
        res.send(zip.toBuffer());
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/recursos/:id/posts', (req, res) => {
    const novoPost = new Post({ recursoId: req.params.id, autor: req.body.autor, titulo: req.body.titulo, conteudo: req.body.conteudo });
    novoPost.save().then(dados => res.status(201).json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

router.post('/recursos/:id/avaliar', (req, res) => {
    RecursoController.avaliar(req.params.id, parseInt(req.body.nota)).then(dados => res.json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

router.delete('/posts/:id', verificaToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ erro: "Post não encontrado." });

        if (post.autor !== req.user.nome && req.user.nivel !== 'administrador') {
            return res.status(403).json({ erro: "Não tens permissão para apagar este post." });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ mensagem: "Post apagado com sucesso." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/posts/:postId/comentarios/:comentarioId', verificaToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ erro: "Post não encontrado." });

        const comentario = post.comentarios.id(req.params.comentarioId);
        if (!comentario) return res.status(404).json({ erro: "Comentário não encontrado." });

        if (comentario.autor !== req.user.nome && req.user.nivel !== 'administrador') {
            return res.status(403).json({ erro: "Não tens permissão para apagar este comentário." });
        }

        await Post.findByIdAndUpdate(req.params.postId, {
            $pull: { comentarios: { _id: req.params.comentarioId } }
        });
        res.json({ mensagem: "Comentário apagado com sucesso." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/posts/:id/comentarios', (req, res) => {
    const novoComentario = { autor: req.body.autor, conteudo: req.body.conteudo, data: new Date() };
    PostController.adicionarComentario(req.params.id, novoComentario).then(dados => res.status(201).json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

router.get('/usuarios', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try {
        const users = await User.listar(); 
        res.json(users);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.patch('/usuarios/:id/nivel', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try {
        await User.atualizar(req.params.id, { nivel: req.body.nivel });
        res.json({ mensagem: "Nível atualizado com sucesso." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/usuarios/:id', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try {
        await User.eliminar(req.params.id); 
        res.json({ mensagem: "Utilizador removido com sucesso." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;