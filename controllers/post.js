const Post = require('../models/post');

// Listar todos os posts associados a um recurso
module.exports.listarPorRecurso = (recursoId) => {
    return Post.find({ recursoId: recursoId })
               .sort({ createdAt: -1 })
               .exec();
};

// Criar post
module.exports.inserir = (dados) => {
    const novo = new Post(dados);
    return novo.save();
};

// Adicionar um comentário a um post 
module.exports.adicionarComentario = (postId, comentario) => {
    return Post.findByIdAndUpdate(
        postId,
        { $push: { comentarios: comentario } },
        { new: true }
    ).exec();
};