const unless = require('express-unless');
const jwt = require('jsonwebtoken');
const appConfig = require("../config/app.config.js");
const logger=require('../logger'); 

module.exports = myapp => {
  const pos = require("../logic/pos.logic");
  //const unless = require('express-unless');
  var router = require("express").Router();

  checkJWT.unless = unless;   //use "unless" module to exclude specific requests for CheckJWT 
  router.use(checkJWT.unless({
    path: ['/login','/weblogin','/auth/token','/downloadupdateengine','/BackupPS','/BackupConfig','/restore','/cancelAction']
  }))
  router.post("/login", pos.login);
  router.post("/restore", pos.restore);
  router.post("/upload", pos.upload);
  router.post("/psaction", pos.psaction);
  myapp.use('/api/pos', router);
};

function checkJWT(request, response, next) { //Function used by Router to verify token
  if (request.headers.authorization) {// check headers params
    logger.verbose (request.headers.authorization)
    jwt.verify(request.headers.authorization, appConfig.tokenproperties.secret, function (err, decoded) {  // check valid token
      if (err) {
        logger.error("CheckJWT failed: not authorized");
        response.statusMessage = 'You are not authorized';
        return response.status(401).send('You are not authorized')
      } else {
        //console.log (decoded);
        next()}
    })
  } else {
    logger.error("CheckJWT failed: not authorized");
    response.statusMessage = 'You are not authorized';
    return response.status(401).send('You are not authorized')//json({message:'You are not allowed'})
  }
}