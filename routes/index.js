const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const auth = require('../auth/auth'); 
const AdmZip = require('adm-zip');

const upload = multer({ dest: 'uploads/sips/' });
const apiURL = "http://localhost:7777/api";

router.get('/perfil', auth.verificaAcesso, async (req, res) => {
    try {
        const [userRes, recursosRes] = await Promise.all([
            axios.get(`${apiURL}/usuarios/${req.user.id}`),
            axios.get(`${apiURL}/recursos`)
        ]);
        const meusRecursos = recursosRes.data.filter(r => r.produtor === req.user.nome);
        res.render('perfil', { user: req.user, perfil: userRes.data, meusRecursos, query: req.query });
    } catch (e) { res.render('error', { error: e }); }
});

router.post('/perfil/password', auth.verificaAcesso, (req, res) => {
    axios.patch(`${apiURL}/usuarios/${req.user.id}/password`, {
        passwordAtual: req.body.passwordAtual,
        passwordNova: req.body.passwordNova
    }).then(() => res.redirect('/perfil?sucesso=1'))
      .catch(e => {
          const msg = e.response?.data?.erro || "Erro ao alterar password.";
          res.redirect('/perfil?erro=' + encodeURIComponent(msg));
      });
});

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
    const searchTerm = req.query.search || '';
    
    axios.get(`${apiURL}/recursos`, { params: { search: searchTerm } })
        .then(r => {
            res.render('recursos', { lista: r.data, user: req.user, search: searchTerm });
        })
        .catch(err => res.render('error', { error: err }));
});

router.get('/recursos/:id/download', auth.verificaAcesso, async (req, res) => {
    try {
        await axios.post(`${apiURL}/recursos/${req.params.id}/download`);
        const response = await axios.get(`${apiURL}/recursos/${req.params.id}`);
        const recurso = response.data;
        
        const zip = new AdmZip();
        zip.addLocalFolder(recurso.caminhoFicheiro);
        const zipBuffer = zip.toBuffer();
        const nomeFicheiro = recurso.titulo.replace(/\s+/g, '_') + "_EngWeb.zip";
        
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${nomeFicheiro}"`);
        res.send(zipBuffer);
    } catch (e) {
        console.log(e);
        res.render('error', { message: "Erro ao processar o download do ficheiro.", error: e });
    }
});

router.get('/recursos/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`).then(r => res.render('recurso', { recurso: r.data, user: req.user })).catch(err => res.render('error', { error: err }));
});

router.get('/feed', auth.verificaAcesso, async (req, res) => {
    try {
        const [recentesRes, topRes] = await Promise.all([
            axios.get(`${apiURL}/recursos/recentes`),
            axios.get(`${apiURL}/recursos/top`)
        ]);
        
        res.render('feed', { recentes: recentesRes.data, top: topRes.data, user: req.user });
    } catch (e) {
        res.render('error', { error: e });
    }
});

router.post('/recursos/:id/posts', auth.verificaAcesso, (req, res) => {
    const postData = { titulo: req.body.titulo, conteudo: req.body.conteudo, autor: req.user.nome };
    axios.post(`${apiURL}/recursos/${req.params.id}/posts`, postData).then(() => 
        res.redirect('/recursos/' + req.params.id)).catch(err => res.render('error', { error: err }));
});

router.post('/recursos/:id/avaliar', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/recursos/${req.params.id}/avaliar`, { nota: req.body.nota }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
        .then(() => res.redirect('/recursos/' + req.params.id)).catch(e => res.render('error', { error: e }));
});

router.post('/posts/:id/apagar', auth.verificaAcesso, (req, res) => {
    const recursoId = req.body.recursoId;
    axios.delete(`${apiURL}/posts/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/recursos/' + recursoId))
    .catch(e => {
        if (e.response && e.response.status === 403) return res.render('error', { message: "Não tens permissão para apagar este post." });
        res.render('error', { error: e });
    });
});

router.post('/posts/:postId/comentarios/:comentarioId/apagar', auth.verificaAcesso, (req, res) => {
    const recursoId = req.body.recursoId;
    axios.delete(`${apiURL}/posts/${req.params.postId}/comentarios/${req.params.comentarioId}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/recursos/' + recursoId))
    .catch(e => {
        if (e.response && e.response.status === 403) return res.render('error', { message: "Não tens permissão para apagar este comentário." });
        res.render('error', { error: e });
    });
});

router.post('/posts/:id/comentarios', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/posts/${req.params.id}/comentarios`, { autor: req.user.nome, conteudo: req.body.conteudo })
        .then(() => res.redirect('/recursos/' + req.body.recursoId)) 
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

router.get('/admin', auth.verificaAcesso, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Acesso Negado. Esta área é apenas para administradores." });
    try {
        const usersRes = await axios.get(`${apiURL}/usuarios`, { headers: { Authorization: `Bearer ${req.cookies.token}` } });
        res.render('admin', { user: req.user, usuarios: usersRes.data });
    } catch (e) { res.render('error', { error: e }); }
});

router.post('/admin/usuarios/:id/nivel', auth.verificaAcesso, (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Sem permissão." });
    axios.patch(`${apiURL}/usuarios/${req.params.id}/nivel`, { nivel: req.body.nivel }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/admin'))
    .catch(e => res.render('error', { error: e }));
});

router.post('/admin/usuarios/:id/apagar', auth.verificaAcesso, (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Sem permissão." });
    axios.delete(`${apiURL}/usuarios/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/admin'))
    .catch(e => res.render('error', { error: e }));
});

router.get('/perfil/editar', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/usuarios/${req.user.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(dados => res.render('edit_perfil', { user: dados.data , isAdminEdit: false}))
    .catch(e => res.render('error', { error: e }));
});

router.post('/perfil/editar', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/usuarios/${req.user.id}`, req.body, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/perfil'))
    .catch(e => res.render('error', { error: e }));
});

router.get('/recursos/editar/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(dados => res.render('edit_recurso', { r: dados.data }))
    .catch(e => res.render('error', { error: e }));
});

router.post('/recursos/editar/:id', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/recursos/${req.params.id}`, req.body, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect(`/recursos/${req.params.id}`))
    .catch(e => res.render('error', { error: e }));
});

// Página de edição para o Admin (carrega os dados do utilizador com ID :id)
router.get('/admin/usuarios/:id/editar', auth.verificaAcesso, async (req, res) => {
    // Verifica se é administrador
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Acesso Negado." });

    try {
        const dados = await axios.get(`${apiURL}/usuarios/${req.params.id}`, { 
            headers: { Authorization: `Bearer ${req.cookies.token}` } 
        });
        res.render('edit_perfil', { user: dados.data, isAdminEdit: true });
    } catch (e) { res.render('error', { error: e }); }
});

// Guardar edições feitas pelo Admin
router.post('/admin/usuarios/:id/editar', auth.verificaAcesso, (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Acesso Negado." });
    
    axios.put(`${apiURL}/usuarios/${req.params.id}`, req.body, { 
        headers: { Authorization: `Bearer ${req.cookies.token}` } 
    })
    .then(() => res.redirect('/admin')) 
    .catch(e => res.render('error', { error: e }));
});

router.get('/', (req, res) => res.redirect('/recursos'));

module.exports = router;