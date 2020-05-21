const store = require("../database");
const logger=require('../logger'); 
const appConfig = require("../config/app.config.js");
const jwt = require('jsonwebtoken');
var randtoken = require('rand-token');
var tokenproperties = appConfig.tokenproperties;  //Token
var refreshTokens = {};
var usersrole = {};

exports.login = (req, res) => {  // Login Service
  var username = req.body.user,
  password = req.body.password;
  var role = req.url === '/login'?'api':'web'
  if (username == null || password == null || username == '' || password ==''){return res.status(400).send("Bad request, check params please")}
  store.login(username,password, role, function (err, lresult) {
    if (err) {
      logger.error("Login error:"+err);
      return res.status(500).send("Error while logging in");
    }else{
      if (lresult.success){
        //req.session.username = username;
        logger.debug(`Login OK for user ${username}. Token expires in ${Math.round(tokenproperties.tokenTimeout / 6)/10} minutes`)      ;
        var token = jwt.sign({ id: username, role: lresult.role }, tokenproperties.secret, {
          expiresIn: tokenproperties.tokenTimeout
        });
        var refreshToken = randtoken.uid(256)
        refreshTokens[refreshToken] = username
        usersrole[username] = lresult.role
        res.status(200).send({ auth: true, token: token, refreshtoken: refreshToken, role: lresult.role});
      }else{
        logger.warn(`Login failed for user ${username}: ${lresult.message}`);
        res.status(401).send({ auth: false});
      }
    }
  })
}

exports.logout = (req, res) => {
  req.session.reset();
  logger.info(req.session.user)
}

//TODO: remove old refreshtoken + refreshtoken expiration
exports.refreshtoken = (req, res) => { 
  var username = req.body.user
  var refreshToken = req.body.refreshtoken
  if((refreshToken in refreshTokens) && (refreshTokens[refreshToken] == username)) {
    var token = jwt.sign({ id: username, role: usersrole[username]}, tokenproperties.secret, {
      expiresIn: tokenproperties.tokenTimeout
    });
    logger.debug(`Token refreshed for user ${username} : sending new token that will expire in ${Math.round(tokenproperties.tokenTimeout / 6)/10} minutes`);
    res.status(200).send({ auth: true, token: token})
  }
  else {
    logger.error(`Refresh token not available for user ${username}`);
    res.status(401).send({ auth: false});
  }
}

exports.backuplog = (req, res) => { 
  store.getbackupLog('super',req.query.action,(err, rows) => {
    return res.status(200).send(rows);
  })
}

exports.requestAction = (req, res) => { 
	if (req.body.computerId === null) {
    logger.error('ComputerId is missing')
    return res.status(500).send('ComputerId is missing')
	}
	if (req.body.action === null) {
    logger.error('Action is missing')
    return res.status(500).send('Action is missing')
	}
	store.requestAction(req.body.computerId, req.body.action, (err, rres) => {
    if(err){
      logger.error(`Request of action ${req.body.action} for ${req.body.computerId} failed: ` + err)
      return res.status(500).send(`Request of action ${req.body.action} for ${req.body.computerId} failed`)
    }else if (rres === null) {
      logger.error(`Action ${req.body.action} not valid`)
      return res.status(500).send(`Action ${req.body.action} not valid`)
    }
    else if (rres === 0){
      logger.error(`computerid ${req.body.action} not valid`)
      return res.status(500).send(`computerid ${req.body.computerId} not valid`)
    }
    else{
      logger.info(`Action ${rres} queued for POS ${req.body.computerId}`)
      return res.status(200).send(`ok:${rres}`)
    }
	})
}

exports.cancelAction = (req, res) => { 
	if (req.body.computerId === null) {
    logger.error('ComputerId is missing')
    return res.status(500).send('ComputerId is missing')
	}
	if (req.body.action === null) {
    logger.error('Action is missing')
    return res.status(500).send('Action is missing')
	}
	store.cancelAction(req.body.computerId, req.body.action, (err, rres) => {
    if(err){
      logger.error(`Cancel action ${req.body.action} for ${req.body.computerId} failed: ` + err)
      return res.status(500).send(`Cancel action for ${req.body.computerId} failed`)
    } else if (rres === null) {
      logger.error(`Action ${req.body.action} not valid`)
      return res.status(500).send(`Action ${req.body.action} not valid`)
    }
    else{
      logger.info(`Action ${rres} cancelled`)
      return res.status(200).send(`ok:${rres}`)
    }
	})
}