const cookieParser = require('cookie-parser');
const unless = require('express-unless');
const checkJWT = require('../auth').checkJWT;

module.exports = myapp => {
  const front = require("../logic/front.logic");
  const pos = require("../logic/pos.logic");
  var router = require("express").Router();
  checkJWT.unless = unless;   //use "unless" module to exclude specific requests for CheckJWT
  router.use(cookieParser());
  router.use(checkJWT.unless({path: ['/login','/api/front/weblogin','/api/front/refreshtoken']})) // Use JWT auth to secure the API router
  router.post("/api/front/weblogin", front.login);
  router.post("/api/front/refreshtoken", front.refreshtoken);
  router.post("/api/front/logout", front.logout);
  router.post("/api/front/requestAction", front.requestAction);
  router.post("/api/front/cancelAction", front.cancelAction);
  router.get("/api/front/backuplog", front.backuplog);
  router.post("/login", pos.login);
  router.get("/psaction", pos.psaction);
  router.post("/upload", pos.upload);
  //router.post("/restore", pos.restore);
  myapp.use('/', router);
};

