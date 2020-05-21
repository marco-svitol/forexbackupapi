const unless = require('express-unless');
const jwt = require('jsonwebtoken');
const appConfig = require("../config/app.config.js");
const logger=require('../logger'); 

module.exports = myapp => {
  const front = require("../logic/front.logic");
  var router = require("express").Router();
  checkJWT.unless = unless;   //use "unless" module to exclude specific requests for CheckJWT
  router.use(checkJWT.unless({path: ['/api/front/login','/api/front/refreshtoken']})) // Use JWT auth to secure the API router
  router.post("/login", front.login);
  router.post("/auth/token'", front.refreshtoken);
  router.post("/logout", front.logout);
  router.post("/requestAction", front.requestAction);
  router.post("/cancelAction", front.cancelAction);
  router.post("/backuplog", front.backuplog);
  myapp.use('/api/front', router);
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