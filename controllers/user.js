const User = require('../models/user');

// Listar todos os utilizadores 
module.exports.listar = () => {
    return User.find()
               .sort({ nome: 1 })
               .exec();
};

// Consultar utilizador por ID
module.exports.consultar = (id) => {
    return User.findById(id).exec();
};

// Consultar utilizador por Email
module.exports.consultarPorEmail = (email) => {
    return User.findOne({ email: email }).exec();
};

// Inserir utilizador
module.exports.inserir = (dados) => {
    const novo = new User(dados);
    return novo.save();
};

// Atualizar dados de um utilizador 
module.exports.atualizar = (id, dados) => {
    return User.findByIdAndUpdate(id, dados, { new: true }).exec();
};

// Eliminar um utilizador
module.exports.eliminar = (id) => {
    return User.findByIdAndDelete(id).exec();
};

