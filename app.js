const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const session = require('express-session');
const flash = require('connect-flash');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const indexRouter = require('./routes/index'); 
const apiRouter = require('./routes/api');

const app = express();


const mongoDB = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/mongoEW';

mongoose.connect(mongoDB)
  .then(() => console.log("Ligação ao MongoDB efetuada com sucesso!"))
  .catch(err => console.error('Erro de ligação ao MongoDB:', err));

const db = mongoose.connection;
// -----------------------------------------------------------

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); 
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configuração de Sessão e Flash
app.use(session({
  secret: 'ProjetoEW2026_Secret_Key',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

// Middleware para variáveis globais nas views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || req.session.user || null; 
  next();
});

// Rotas
app.use('/api', apiRouter); 
app.use('/', indexRouter); 

// Gestão de Erros
app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : { status: err.status };
  res.status(err.status || 500);
  res.render('error', { user: res.locals.user });
});

// Definição da Porta 
const PORT = process.env.PORT || 7777;
app.listen(PORT, () => {
  console.log(`
  🚀 Servidor EngWeb2026 pronto!
  🌍 URL: http://localhost:${PORT}
  📦 DB: ${mongoDB}
  `);
});

module.exports = app;