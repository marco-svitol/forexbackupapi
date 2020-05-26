const jwt = require('jsonwebtoken');
var randtoken = require('rand-token');
const appConfig = require("../config/app.config.js");
var tokenproperties = appConfig.tokenproperties;  //Token

const logger=require('../logger');
var refreshTokens = {};
var usersrole = {};

module.exports.generateToken = function(res, username, role ) {
  var token = jwt.sign({ id: username, role: role }, tokenproperties.secret, {
    expiresIn: tokenproperties.tokenTimeout
  });
  var refreshToken = randtoken.uid(256)
  refreshTokens[refreshToken] = username
  usersrole[username] = role
  return res.cookie('token', token, {
    maxAge: tokenproperties.tokenTimeout * 1000,
    secure: (process.env.COOKIESECURE.toLowerCase() === 'true'),
    httpOnly: true
  } )
}

module.exports.generateTokenRefresh = function(res, username, refreshToken) {
  if((refreshToken in refreshTokens) && (refreshTokens[refreshToken] == username)) {
    var token = jwt.sign({ id: username, role: usersrole[username]}, tokenproperties.secret, {
      expiresIn: tokenproperties.tokenTimeout
    });
    return res.cookie('token', token, {
      maxAge: tokenproperties.tokenTimeout * 1000,
      secure: true,
      httpOnly: true
    })
  }else return null
}


module.exports.checkJWT = function(req, res, next) { //Function used by Router to verify token
    const token = req.cookies.token || '';
    try{
      if(!token){
        logger.error("CheckJWT failed: not authorized");
        return res.status(401).send('You are not authorized')
      }
      const decrypt = jwt.verify(token, appConfig.tokenproperties.secret);
      req.user = {
        id: decrypt.id,
        role: decrypt.role
      };
      next();
    }catch(err){
      logger.error(`Error while checking JWT: ${err}`);
      return res.status(500).send(`Error while checking JWT`);
    }
}

module.exports.logout = (req, res) => {
  this.checkJWT(req,res, () =>{
    logger.debug(`Logging out user ${req.user.id} with role ${req.user.role}`)
    return res.clearCookie('token').status(200).send('ok');
  })
};



module.exports.checkJWTOld = function(req, res, next) { //Function used by Router to verify token
  if (req.headers.authorization) {// check headers params
    logger.verbose (req.headers.authorization)
    jwt.verify(req.headers.authorization, appConfig.tokenproperties.secret, function (err, decoded) {  // check valid token
      if (err) {
        logger.error("CheckJWT failed: not authorized");
        res.statusMessage = 'You are not authorized';
        return res.status(401).send('You are not authorized')
      } else {
        //console.log (decoded);
        next()}
    })
  } else {
    logger.error("CheckJWT failed: not authorized");
    res.statusMessage = 'You are not authorized';
    return res.status(401).send('You are not authorized')//json({message:'You are not allowed'})
  }
}