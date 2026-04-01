const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');

const indexRouter = require('./routes/index'); 
const apiRouter = require('./routes/api');

const app = express();


const mongoDB = 'mongodb://127.0.0.1/mongoEW';
mongoose.connect(mongoDB);
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Erro de ligação ao MongoDB...'));
db.once('open', () => console.log("Ligação ao MongoDB efetuada com sucesso!"));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); 
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
app.use('/api', apiRouter); 
app.use('/', indexRouter); 

// Erros
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

const PORT = 7777;
app.listen(PORT, () => console.log(`Servidor EngWeb2026 na porta ${PORT}...`));

module.exports = app;