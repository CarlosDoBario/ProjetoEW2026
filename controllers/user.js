const User = require('../models/user');
const bcrypt = require('bcryptjs');

// Listar todos os utilizadores
exports.listar = () => {
    return User.find().sort({ nome: 1 });
};

// Consultar um utilizador por ID
exports.consultar = id => {
    return User.findById(id);
};

// Consultar por email (usado no login)
exports.consultarPorEmail = email => {
    return User.findOne({ email: email });
};

// Inserir um novo utilizador com Password Hashing
exports.inserir = u => {
    const salt = bcrypt.genSaltSync(10);
    u.password = bcrypt.hashSync(u.password, salt);
    return User.create(u);
};

// Atualizar utilizador (incluindo tratamento de password se necessário)
exports.atualizar = (id, data) => {
    if (data.password) {
        const salt = bcrypt.genSaltSync(10);
        data.password = bcrypt.hashSync(data.password, salt);
    }
    return User.findByIdAndUpdate(id, data, { new: true });
};

// Eliminar utilizador
exports.eliminar = id => {
    return User.findByIdAndDelete(id);
};