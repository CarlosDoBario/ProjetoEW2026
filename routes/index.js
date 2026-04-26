const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const auth = require('../auth/auth'); 
const AdmZip = require('adm-zip');
const path = require('path');

const upload = multer({ dest: 'uploads/sips/' });
const apiURL = "http://localhost:7777/api";

// --- LOGIN / LOGOUT / REGISTO ---
router.get('/login', (req, res) => res.render('login'));
router.post('/login', (req, res) => {
    axios.post(`${apiURL}/usuarios/login`, req.body).then(response => {
        res.cookie('token', response.data.token);
        req.flash('success', 'Login efetuado com sucesso!');
        res.redirect('/recursos');
    }).catch(() => {
        req.flash('error', 'Credenciais inválidas.');
        res.redirect('/login');
    });
});
router.get('/logout', (req, res) => { 
    res.clearCookie('token'); 
    req.flash('success', 'Sessão terminada.');
    res.redirect('/login'); 
});

router.get('/registo', (req, res) => res.render('registo'));
router.post('/registo', (req, res) => {
    axios.post(`${apiURL}/usuarios/registo`, req.body)
        .then(() => {
            req.flash('success', 'Registo efetuado com sucesso! Pode iniciar sessão.');
            res.redirect('/login');
        })
        .catch(e => {
            req.flash('error', 'Erro no registo: ' + (e.response?.data?.erro || 'Tente novamente.'));
            res.redirect('/registo');
        });
});

// --- PERFIL ---
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
    axios.patch(`${apiURL}/usuarios/${req.user.id}/password`, req.body)
        .then(() => {
            req.flash('success', 'Palavra-passe alterada com sucesso!');
            res.redirect('/perfil');
        })
        .catch(e => {
            req.flash('error', 'Erro ao alterar password: ' + (e.response?.data?.erro || 'Erro'));
            res.redirect('/perfil');
        });
});

router.get('/perfil/editar', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/usuarios/${req.user.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(dados => res.render('edit_perfil', { user: dados.data, isAdminEdit: false }))
    .catch(e => res.render('error', { error: e }));
});

router.post('/perfil/editar', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/usuarios/${req.user.id}`, req.body, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Perfil atualizado com sucesso!');
        res.redirect('/perfil');
    }).catch(e => {
        req.flash('error', 'Erro ao atualizar perfil.');
        res.redirect('/perfil/editar');
    });
});

// --- RECURSOS ---
router.get('/recursos', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos`, { params: req.query })
        .then(r => {
            res.render('recursos', { 
                lista: r.data, 
                user: req.user, 
                filtros: req.query 
            });
        })
        .catch(err => res.render('error', { error: err }));
});

router.get('/recursos/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`).then(r => res.render('recurso', { recurso: r.data, user: req.user })).catch(err => res.render('error', { error: err }));
});

// DOWNLOAD
router.get('/recursos/:id/download', auth.verificaAcesso, async (req, res) => {
    try {
        await axios.post(`${apiURL}/recursos/${req.params.id}/download`);
        const response = await axios.get(`${apiURL}/recursos/${req.params.id}`);
        const recurso = response.data;
        const zip = new AdmZip();
        zip.addLocalFolder(recurso.caminhoFicheiro);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${recurso.titulo.replace(/\s+/g, '_')}_EngWeb.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { 
        req.flash('error', 'Erro ao processar download.');
        res.redirect('/recursos/' + req.params.id); 
    }
});

router.get('/recursos/editar/:id', auth.verificaAcesso, (req, res) => {
    axios.get(`${apiURL}/recursos/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(dados => res.render('edit_recurso', { r: dados.data })).catch(e => res.render('error', { error: e }));
});

router.post('/recursos/editar/:id', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/recursos/${req.params.id}`, req.body, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Recurso editado com sucesso!');
        res.redirect(`/recursos/${req.params.id}`);
    }).catch(e => {
        req.flash('error', 'Erro ao editar recurso.');
        res.redirect(`/recursos/editar/${req.params.id}`);
    });
});

router.post('/recursos/:id/avaliar', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/recursos/${req.params.id}/avaliar`, { nota: req.body.nota }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
        .then(() => {
            req.flash('success', 'Avaliação submetida!');
            res.redirect('/recursos/' + req.params.id);
        }).catch(e => {
            req.flash('error', 'Erro ao avaliar.');
            res.redirect('/recursos/' + req.params.id);
        });
});

// --- FEED ---
router.get('/feed', auth.verificaAcesso, async (req, res) => {
    try {
        const [recentesRes, topRes] = await Promise.all([
            axios.get(`${apiURL}/recursos/recentes`),
            axios.get(`${apiURL}/recursos/top`)
        ]);
        res.render('feed', { recentes: recentesRes.data, top: topRes.data, user: req.user });
    } catch (e) { res.render('error', { error: e }); }
});

// --- UPLOAD ---
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
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        req.flash('success', 'Recurso submetido com sucesso!');
        res.redirect('/recursos');
    }).catch(err => {
        req.flash('error', 'Erro ao submeter recurso.');
        res.redirect('/upload');
    });
});

// --- SOCIAL ---
router.post('/recursos/:id/posts', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/recursos/${req.params.id}/posts`, { ...req.body, autor: req.user.nome })
    .then(() => {
        req.flash('success', 'Post publicado!');
        res.redirect('/recursos/' + req.params.id);
    }).catch(err => {
        req.flash('error', 'Erro ao publicar post.');
        res.redirect('/recursos/' + req.params.id);
    });
});

router.post('/posts/:id/apagar', auth.verificaAcesso, (req, res) => {
    axios.delete(`${apiURL}/posts/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Post removido.');
        res.redirect('/recursos/' + req.body.recursoId);
    }).catch(e => {
        req.flash('error', 'Erro ao remover post.');
        res.redirect('/recursos/' + req.body.recursoId);
    });
});

router.post('/posts/:id/comentarios', auth.verificaAcesso, (req, res) => {
    axios.post(`${apiURL}/posts/${req.params.id}/comentarios`, { autor: req.user.nome, conteudo: req.body.conteudo })
        .then(() => res.redirect('/recursos/' + req.body.recursoId)).catch(e => res.render('error', { error: e }));
});

router.post('/posts/:postId/comentarios/:comentarioId/editar', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/posts/${req.params.postId}/comentarios/${req.params.comentarioId}`, { conteudo: req.body.conteudo }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Comentário editado.');
        res.redirect('/recursos/' + req.body.recursoId);
    }).catch(e => res.render('error', { error: e }));
});

router.post('/posts/:postId/comentarios/:comentarioId/apagar', auth.verificaAcesso, (req, res) => {
    axios.delete(`${apiURL}/posts/${req.params.postId}/comentarios/${req.params.comentarioId}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/recursos/' + req.body.recursoId)).catch(e => res.render('error', { error: e }));
});

// --- ADMIN ---
router.get('/admin', auth.verificaAcesso, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Acesso Negado." });
    try {
        const usersRes = await axios.get(`${apiURL}/usuarios`, { headers: { Authorization: `Bearer ${req.cookies.token}` } });
        res.render('admin', { user: req.user, usuarios: usersRes.data });
    } catch (e) { res.render('error', { error: e }); }
});

router.get('/admin/usuarios/:id/editar', auth.verificaAcesso, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.render('error', { message: "Acesso Negado." });
    try {
        const dados = await axios.get(`${apiURL}/usuarios/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } });
        res.render('edit_perfil', { user: dados.data, isAdminEdit: true });
    } catch (e) { res.render('error', { error: e }); }
});

router.post('/admin/usuarios/:id/editar', auth.verificaAcesso, (req, res) => {
    axios.put(`${apiURL}/usuarios/${req.params.id}`, req.body, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Utilizador editado.');
        res.redirect('/admin');
    }).catch(e => res.render('error', { error: e }));
});

router.post('/admin/usuarios/:id/nivel', auth.verificaAcesso, (req, res) => {
    axios.patch(`${apiURL}/usuarios/${req.params.id}/nivel`, { nivel: req.body.nivel }, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => res.redirect('/admin')).catch(e => res.render('error', { error: e }));
});

router.post('/admin/usuarios/:id/apagar', auth.verificaAcesso, (req, res) => {
    axios.delete(`${apiURL}/usuarios/${req.params.id}`, { headers: { Authorization: `Bearer ${req.cookies.token}` } })
    .then(() => {
        req.flash('success', 'Utilizador removido.');
        res.redirect('/admin');
    }).catch(e => res.render('error', { error: e }));
});

router.get('/recursos/:id/ficheiro/:nome', auth.verificaAcesso, async (req, res) => {
    try {
        const response = await axios.get(`${apiURL}/recursos/${req.params.id}`);
        const recurso = response.data;
        const caminhoCompleto = path.join(recurso.caminhoFicheiro, req.params.nome);
        res.download(caminhoCompleto); 
    } catch (e) { 
        req.flash('error', 'Erro ao descarregar ficheiro.');
        res.redirect('/recursos/' + req.params.id);
    }
});

router.get('/', (req, res) => res.redirect('/recursos'));

module.exports = router;