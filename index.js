const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const auth = require('../auth/auth'); 

const upload = multer({ dest: 'uploads/sips/' });
const apiURL = "http://localhost:7777/api";

router.get('/login', (req, res) => res.render('login'));

router.post('/login', (req, res) => {
    axios.post(`${apiURL}/usuarios/login`, req.body).then(response => {
        res.cookie('token', response.data.token);
        res.redirect('/recursos');
    }).catch(() => res.render('error', { message: "Login falhou." }));
});

router.get('/registo', (req, res) => res.render('registo'));

router.post('/registo', (req, res) => {
    axios.post(`${apiURL}/usuarios/registo`, req.body).then(() => res.redirect('/login')).catch(e => res.render('error', { message: "Erro no registo.", error: e }));
});

router.get('/logout', (req, res) => { res.clearCookie('token'); res.redirect('/login'); });

router.get('/recursos', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos`).then(r => res.render('recursos', { lista: r.data, user: req.user })).catch(err => res.render('error', { error: err }));
});

router.get('/recursos/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`).then(r => res.render('recurso', { recurso: r.data, user: req.user })).catch(err => res.render('error', { error: err }));
});

router.post('/recursos/:id/posts', auth.verificaAcesso, (req, res) => {
    const postData = { titulo: req.body.titulo, conteudo: req.body.conteudo, autor: req.user.nome };
    axios.post(`${apiURL}/recursos/${req.params.id}/posts`, postData).then(() => res.redirect('/recursos/' + req.params.id)).catch(err => res.render('error', { error: err }));
});

router.post('/recursos/:id/avaliar', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/recursos/${req.params.id}/avaliar`, { nota: req.body.nota }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
        .then(() => res.redirect('/recursos/' + req.params.id)).catch(e => res.render('error', { error: e }));
});

router.post('/posts/:id/apagar', auth.verificaAcesso, (req, res) => {
    const recursoId = req.body.recursoId;
    axios.delete(`${apiURL}/posts/${req.params.id}`, { data: { autorSolicitante: req.user.nome } })
        .then(() => res.redirect('/recursos/' + recursoId))
        .catch(e => {
            if (e.response && e.response.status === 403)
                return res.render('error', { message: "Não tens permissão para apagar este post." });
            res.render('error', { error: e });
        });
});

router.post('/posts/:postId/comentarios/:comentarioId/apagar', auth.verificaAcesso, (req, res) => {
    const recursoId = req.body.recursoId;
    axios.delete(`${apiURL}/posts/${req.params.postId}/comentarios/${req.params.comentarioId}`, { data: { autorSolicitante: req.user.nome } })
        .then(() => res.redirect('/recursos/' + recursoId))
        .catch(e => {
            if (e.response && e.response.status === 403)
                return res.render('error', { message: "Não tens permissão para apagar este comentário." });
            res.render('error', { error: e });
        });
});

router.post('/posts/:id/comentarios', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/posts/${req.params.id}/comentarios`, { autor: req.user.nome, conteudo: req.body.conteudo })
        .then(() => res.redirect('/recursos/' + req.body.recursoId)) // Redireciona para o recurso pai
        .catch(e => res.render('error', { error: e }));
});

router.get('/upload', auth.verificaAcesso, (req, res) => {
    if (req.user.nivel === 'consumidor') return res.render('error', { message: "Sem permissão." });
    res.render('upload', { user: req.user });
});

router.post('/upload', auth.verificaAcesso, upload.single('recursoZip'), (req, res) => {
    const form = new FormData();
    form.append('produtor', req.user.nome);
    form.append('visibilidade', req.body.visibilidade);
    form.append('recursoZip', fs.createReadStream(req.file.path));
    axios.post(`${apiURL}/recursos`, form, { headers: { ...form.getHeaders() } }).then(() => {
        fs.unlinkSync(req.file.path);
        res.redirect('/recursos');
    }).catch(err => res.render('error', { error: err }));
});

router.get('/', (req, res) => res.redirect('/recursos'));

module.exports = router;