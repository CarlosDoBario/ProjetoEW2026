const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fsExtra = require('fs-extra');
const UserModel = require('../models/user'); 

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

// --- UTILIZADORES ---
router.get('/usuarios', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try { const users = await User.listar(); res.json(users); } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/usuarios/:id', async (req, res) => {
    try {
        const user = await User.consultar(req.params.id);
        if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
        const { password, ...dados } = user._doc;
        res.json(dados);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/usuarios/login', (req, res) => {
    User.consultarPorEmail(req.body.email).then(dados => {
        if (dados && bcrypt.compareSync(req.body.password, dados.password)) {
            const token = jwt.sign({ nome: dados.nome, nivel: dados.nivel, email: dados.email, id: dados._id }, secret, { expiresIn: '1h' });
            res.status(200).json({ token: token });
        } else { res.status(401).json({ mensagem: "Credenciais inválidas" }); }
    }).catch(e => res.status(500).json({ erro: e.message }));
});

router.post('/usuarios/registo', (req, res) => {
    User.inserir(req.body).then(dados => res.status(201).json(dados)).catch(e => res.status(500).json({ erro: e.message }));
});

router.patch('/usuarios/:id/password', async (req, res) => {
    try {
        const user = await User.consultar(req.params.id);
        if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
        if (!bcrypt.compareSync(req.body.passwordAtual, user.password)) return res.status(403).json({ erro: "Password atual incorreta." });
        await User.atualizar(req.params.id, { password: req.body.passwordNova });
        res.json({ mensagem: "Password atualizada." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.patch('/usuarios/:id/nivel', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try { await User.atualizar(req.params.id, { nivel: req.body.nivel }); res.json({ mensagem: "Nível atualizado." }); } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/usuarios/:id', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    try { await User.eliminar(req.params.id); res.json({ mensagem: "Removido." }); } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/usuarios/:id', verificaToken, async (req, res) => {
    try {
        const ehProprio = (req.user.id === req.params.id);
        const ehAdmin = (req.user.nivel === 'administrador');
        if (!ehProprio && !ehAdmin) return res.status(403).json({ erro: "Acesso negado." });
        let updateData = { ...req.body };
        if (ehAdmin && !ehProprio) { delete updateData.password; delete updateData.email; delete updateData.nivel; }
        const user = await User.atualizar(req.params.id, updateData);
        res.json(user);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// --- RECURSOS ---
router.get('/recursos', async (req, res) => {
    try {
        let query = {};
        let sort = { dataRegisto: -1 }; 

        if (req.query.search) query.titulo = { $regex: req.query.search, $options: 'i' };
        if (req.query.tipo) query.tipo = req.query.tipo;
        if (req.query.sort) {
            if (req.query.sort === 'data') sort = { dataRegisto: -1 };
            if (req.query.sort === 'downloads') sort = { downloads: -1 };
            if (req.query.sort === 'titulo') sort = { titulo: 1 };
        }

        const recursos = await Recurso.find(query).sort(sort);
        res.json(recursos);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// REMOÇÃO DE RECURSOS
router.delete('/recursos/:id', verificaToken, async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: "Recurso não encontrado." });

        // Verificação: Administrador ou o próprio Produtor
        if (req.user.nivel !== 'administrador' && recurso.produtor !== req.user.nome) {
            return res.status(403).json({ erro: "Não tem permissão para apagar este recurso." });
        }

        if (recurso.caminhoFicheiro) {
            fs.rmSync(recurso.caminhoFicheiro, { recursive: true, force: true });
        }
        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Recurso eliminado com sucesso.' });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/recursos', upload.single('recursoZip'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ erro: "ZIP não recebido." });

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries(); 

        const manifestEntry = zipEntries.find(entry => 
            !entry.isDirectory && 
            entry.entryName.split('/').length === 1 && 
            entry.entryName.toLowerCase().endsWith('.json')
        );

        if (!manifestEntry) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: "Erro: Não foi encontrado nenhum ficheiro de configuração (.json) na raiz do ZIP." });
        }

        let manifest;
        try {
            const content = manifestEntry.getData().toString('utf8');
            manifest = JSON.parse(content);
        } catch (e) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: `Erro de formato: O ficheiro '${manifestEntry.entryName}' contém erros de sintaxe.` });
        }

        // 1. Validação de Metadados (O que já tinhas)
        const campos = ['titulo', 'tipo', 'dataCriacao'];
        const emFalta = campos.filter(c => !manifest[c]);
        if (emFalta.length > 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: `Faltam os campos obrigatórios: ${emFalta.join(', ')}` });
        }

        // =========================================================================
        // 2. VALIDAÇÃO ESTRUTURAL DO SIP (Obrigatório)
        // =========================================================================
        
        // Verifica se o manifesto tem a lista de ficheiros declarada
        if (!manifest.ficheiros || !Array.isArray(manifest.ficheiros)) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: "Validação SIP Falhou: O manifesto não contém um array 'ficheiros' válido." });
        }

        // Obtém o nome de todos os ficheiros e pastas que vêm dentro do ZIP
        const nomesNoZip = zipEntries.map(e => e.entryName);

        // Verifica se todos os ficheiros declarados no manifesto existem realmente no ZIP
        const ficheirosEmFalta = manifest.ficheiros.filter(ficheiro => !nomesNoZip.includes(ficheiro));

        if (ficheirosEmFalta.length > 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            // Cumpre a exigência: "um relatório de erros deverá ser enviado a quem fez a submissão"
            return res.status(400).json({ 
                erro: `Validação Estrutural SIP Falhou: Ficheiros declarados no manifesto não foram encontrados no ZIP: [${ficheirosEmFalta.join(', ')}].` 
            });
        }
        // =========================================================================

        // 3. Se passou em tudo, guardar na BD
        const novoRecurso = new Recurso({
            titulo: manifest.titulo,
            tipo: manifest.tipo,
            dataRegisto: new Date(),
            produtor: req.body.produtor,
            visibilidade: req.body.visibilidade || 'público',
            downloads: 0
        });

        const guardado = await novoRecurso.save();

        const storagePath = path.join(__dirname, '../uploads/recursos', guardado._id.toString());
        if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
        
        // Extrair ZIP para a pasta final
        zip.extractAllTo(storagePath, true);
        guardado.caminhoFicheiro = storagePath;
        await guardado.save();

        // Limpar o ficheiro ZIP temporário que o multer criou
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        res.status(201).json(guardado);

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ erro: "Erro interno: " + err.message });
    }
});

router.get('/recursos/recentes', (req, res) => {
    RecursoController.getRecentes().then(dados => res.json(dados)).catch(erro => res.status(500).json(erro));
});

router.get('/recursos/top', (req, res) => {
    RecursoController.getTopRated().then(dados => res.json(dados)).catch(erro => res.status(500).json(erro));
});

router.post('/recursos/:id/download', (req, res) => {
    RecursoController.incrementarDownloads(req.params.id).then(dados => res.json(dados)).catch(erro => res.status(500).json(erro));
});

router.get('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: "Recurso não encontrado" });

        const posts = await Post.find({ recursoId: req.params.id }).sort({ createdAt: -1 });
        let ficheiros = [];
        if (recurso.caminhoFicheiro && fs.existsSync(recurso.caminhoFicheiro)) {
            ficheiros = fs.readdirSync(recurso.caminhoFicheiro);
        }
        res.json({ ...recurso._doc, posts: posts, conteudo: ficheiros });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/recursos/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (recurso && recurso.caminhoFicheiro) fs.rmSync(recurso.caminhoFicheiro, { recursive: true, force: true });
        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Eliminado.' });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/recursos/:id', verificaToken, async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (recurso.produtor !== req.user.nome && req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Negado." });
        const atualizado = await RecursoController.update(req.params.id, req.body);
        res.json(atualizado);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/recursos/:id/avaliar', (req, res) => {
    RecursoController.avaliar(req.params.id, parseInt(req.body.nota)).then(dados => res.json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

// --- POSTS E COMENTÁRIOS ---
router.post('/recursos/:id/posts', (req, res) => {
    const novoPost = new Post({ recursoId: req.params.id, autor: req.body.autor, titulo: req.body.titulo, conteudo: req.body.conteudo });
    novoPost.save().then(dados => res.status(201).json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

router.delete('/posts/:id', verificaToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post.autor !== req.user.nome && req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Negado." });
        await Post.findByIdAndDelete(req.params.id);
        res.json({ mensagem: "Apagado." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/posts/:id/comentarios', (req, res) => {
    const novoComentario = { autor: req.body.autor, conteudo: req.body.conteudo, data: new Date() };
    PostController.adicionarComentario(req.params.id, novoComentario).then(dados => res.status(201).json(dados)).catch(err => res.status(500).json({ erro: err.message }));
});

router.put('/posts/:postId/comentarios/:comentarioId', verificaToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        const comentario = post.comentarios.id(req.params.comentarioId);
        if (comentario.autor !== req.user.nome) return res.status(403).json({ erro: "Apenas autor." });
        comentario.conteudo = req.body.conteudo;
        await post.save();
        res.json(comentario);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/posts/:postId/comentarios/:comentarioId', verificaToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        const comentario = post.comentarios.id(req.params.comentarioId);
        if (comentario.autor !== req.user.nome && req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Negado." });
        await Post.findByIdAndUpdate(req.params.postId, { $pull: { comentarios: { _id: req.params.comentarioId } } });
        res.json({ mensagem: "Apagado." });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});


router.get('/admin/exportar', verificaToken, async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    
    try {
        const zip = new AdmZip();

        // 1. Guardar a base de dados num JSON
        const data = {
            users: await UserModel.find(),
            recursos: await Recurso.find(),
            posts: await Post.find()
        };
        
        // Adiciona o ficheiro JSON diretamente ao ZIP em memória
        const jsonString = JSON.stringify(data, null, 2);
        zip.addFile('db_backup.json', Buffer.from(jsonString, 'utf8'));

        // 2. Guardar a pasta com os ficheiros extraídos
        const recursosPath = path.join(__dirname, '../uploads/recursos');
        if (fs.existsSync(recursosPath)) {
            // Adiciona a pasta inteira ao ZIP com o nome "recursos"
            zip.addLocalFolder(recursosPath, 'recursos');
        }

        // 3. Gerar e Enviar para o Cliente
        const zipBuffer = zip.toBuffer();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename="sistema_backup.zip"');
        res.send(zipBuffer);

    } catch (err) { 
        res.status(500).json({ erro: err.message }); 
    }
});

router.post('/admin/importar', verificaToken, upload.single('backupZip'), async (req, res) => {
    if (req.user.nivel !== 'administrador') return res.status(403).json({ erro: "Acesso negado." });
    
    try {
        if (!req.file) return res.status(400).json({ erro: "ZIP de backup não recebido." });

        const zip = new AdmZip(req.file.path);
        const tempDir = path.join(__dirname, '../uploads/temp_import_' + Date.now());
        zip.extractAllTo(tempDir, true);

        const backupPath = path.join(tempDir, 'db_backup.json');
        if (!fs.existsSync(backupPath)) {
            fsExtra.removeSync(tempDir);
            return res.status(400).json({ erro: "Formato inválido: db_backup.json não encontrado." });
        }

        const rawData = fs.readFileSync(backupPath, 'utf8');
        const data = JSON.parse(rawData);

        // 1. Limpar a Base de Dados atual
        await UserModel.deleteMany({});
        await Recurso.deleteMany({});
        await Post.deleteMany({});

        // ---- CORREÇÃO DOS DADOS ANTIGOS ----
        if (data.recursos && data.recursos.length > 0) {
            data.recursos = data.recursos.map(r => {
                if (r.visibilidade === 'publico') {
                    r.visibilidade = 'público'; // Restaura o acento exigido pelo Schema
                }
                return r;
            });
        }
        // ------------------------------------

        // 2. Restaurar Dados
        if (data.users && data.users.length > 0) await UserModel.insertMany(data.users);
        if (data.recursos && data.recursos.length > 0) await Recurso.insertMany(data.recursos);
        if (data.posts && data.posts.length > 0) await Post.insertMany(data.posts);

        // 3. Restaurar Ficheiros
        const recursosExtraidosDir = path.join(tempDir, 'recursos');
        const targetRecursosDir = path.join(__dirname, '../uploads/recursos');
        
        if (fs.existsSync(targetRecursosDir)) fsExtra.removeSync(targetRecursosDir);
        if (fs.existsSync(recursosExtraidosDir)) {
            fsExtra.copySync(recursosExtraidosDir, targetRecursosDir);
        }

        // 4. Limpeza de ficheiros temporários
        fsExtra.removeSync(tempDir);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ mensagem: "Sistema restaurado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro na importação: " + err.message });
    }
});

module.exports = router;