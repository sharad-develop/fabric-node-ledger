const express = require('express');
const bodyParser = require('body-parser')
const routes = require('./routes/api');

const app = express();

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use('/api', routes);

app.listen(process.env.port || 3000 , () => {

    console.log('now listening for requests......');
});