const cookieParser = require('cookie-parser');
const checkJWT = require('../auth').checkJWT;
const checkJWTOld = require('../auth').checkJWTOld;

module.exports = myapp => {
  const front = require("../logic/front.logic");
  const pos = require("../logic/pos.logic");
  const tokenauth = require('../auth');
  var router = require("express").Router();
  router.use(cookieParser());
  router.post("/api/front/weblogin", front.login);
  router.post("/api/front/refreshtoken", front.refreshtoken);
  router.post("/api/front/logout", checkJWT, tokenauth.logout);
  router.post("/api/front/requestAction", checkJWT, front.requestAction);
  router.post("/api/front/cancelAction", checkJWT, front.cancelAction);
  router.get("/api/front/backuplog", checkJWT, front.backuplog);
  router.post("/api/front/runcompare", checkJWT, front.runcompare);
  router.post("/login", pos.login);
  router.get("/psaction", checkJWTOld, pos.psaction);
  router.post("/upload", checkJWTOld,  pos.upload);
  myapp.use('/', router);
};

