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
    axios.post(`${apiURL}/usuarios/login`, req.body)
        .then(response => {
            res.cookie('token', response.data.token);
            res.redirect('/recursos');
        })
        .catch(() => res.render('error', { message: "Login falhou: Email ou Password incorretos." }));
});

router.get('/registo', (req, res) => res.render('registo'));

router.post('/registo', (req, res) => {
    axios.post(`${apiURL}/usuarios/registo`, req.body)
        .then(() => res.redirect('/login'))
        .catch(e => res.render('error', { message: "Erro no registo. O email já pode estar em uso.", error: e }));
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// --- CONTEÚDO PROTEGIDO ---

router.get('/recursos', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos`)
        .then(response => {
            res.render('recursos', { lista: response.data, user: req.user });
        })
        .catch(err => res.render('error', { error: err }));
});

router.get('/recursos/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`)
        .then(response => {
            res.render('recurso', { recurso: response.data, user: req.user });
        })
        .catch(err => res.render('error', { error: err }));
});

router.post('/recursos/:id/posts', auth.verificaAcesso, (req, res) => {
    // Injetamos o nome do utilizador logado como autor do post
    const postData = { ...req.body, autor: req.user.nome };
    axios.post(`${apiURL}/recursos/${req.params.id}/posts`, postData)
        .then(() => res.redirect('/recursos/' + req.params.id))
        .catch(err => res.render('error', { error: err }));
});

router.get('/upload', auth.verificaAcesso, (req, res) => {
    // Verificação de nível para carregar ficheiros
    if (req.user.nivel === 'consumidor') {
        return res.render('error', { message: "Apenas Produtores ou Admins podem carregar recursos." });
    }
    res.render('upload', { user: req.user });
});

router.post('/upload', auth.verificaAcesso, upload.single('recursoZip'), (req, res) => {
    if (!req.file) return res.render('error', { message: "Selecione um ficheiro ZIP." });

    const form = new FormData();
    form.append('produtor', req.user.nome); // Nome vem do Token
    form.append('visibilidade', req.body.visibilidade);
    form.append('recursoZip', fs.createReadStream(req.file.path));

    axios.post(`${apiURL}/recursos`, form, { headers: { ...form.getHeaders() } })
        .then(() => {
            fs.unlinkSync(req.file.path);
            res.redirect('/recursos');
        })
        .catch(err => {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.render('error', { error: err });
        });
});

router.get('/', (req, res) => res.redirect('/recursos'));

module.exports = router;