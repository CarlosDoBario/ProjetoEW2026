const jwt = require('jsonwebtoken');
const secret = "EngWeb2026_Projeto_Secret";

// Middleware para a Interface 
module.exports.verificaAcesso = function(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, secret, (err, payload) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect('/login');
        }
        req.user = payload; 
        next();
    });
};

// Middleware para a API 
module.exports.verificaAcessoAPI = function(req, res, next) {
    const token = req.cookies.token || req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ erro: "Token inexistente" });
    }

    jwt.verify(token, secret, (err, payload) => {
        if (err) return res.status(401).json({ erro: "Token inválido ou expirado" });
        req.user = payload;
        next();
    });
};