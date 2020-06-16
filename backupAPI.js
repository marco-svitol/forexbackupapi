// ------------------------------------------------------------------------------------- Var initialize
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());
const logger=require('./app/logger'); 
const cors = require('cors');
var corsOptions = {
  origin: [process.env.URLORIGIN,"http://localhost:8080"],
  credentials: true
};
app.use(cors(corsOptions));

//const appConfig = require("../config/app.config.js");
//let store = require('../database');

// default
app.get("/", (req, res) => {
  res.json({ message: "Welcome to ForexBackupAPI" });
});

// Run the context for each request. Assign a unique identifier to each request
app.use(function(req, res, next) { 
  if (Object.keys(req.body).length != 0){
    params = JSON.stringify(req.body)
    if (req.path.includes('login')){params = 'for user ' + req.body.user}
  }else{
    params = JSON.stringify(req.query)
  }
  logger.debug(`${req.path} service request ${params}`)
  next();
});

// case insensitive parameter name
app.use((req, res, next) => {
	req.body = new Proxy(req.body, {  
    get: (target, name) => target[Object.keys(target)
			.find(key => key.toLowerCase() === name.toLowerCase())]	
	}) 
	next();
});

require("./app/routes/routes")(app);

const rTracer = require('cls-rtracer')
app.use(rTracer.expressMiddleware()) // keeps unique ID for each request

// set port, listen for requests
app.listen(process.env.SERVER_PORT, () => {
  logger.info(`Server is running on port ${process.env.SERVER_PORT}.`);
});



