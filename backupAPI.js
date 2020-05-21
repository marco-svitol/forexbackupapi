// ------------------------------------------------------------------------------------- Var initialize
const config_data = require('./config.CerveAPI.json')

let store = require('../mysql.js');

// Sensitive MUST BE stored on server env variables and NOT here
config_data.tokenproperties.secret = '0AA6HYNULqqw44kZZMSd'
config_data.crypto.password = 'C3rv3ll0Qu4nt1stic0DiM0rnaGo:|:|' 

let debugging = config_data.debug.enabled

const express = require('express'); 
const app = express();
const jwt = require('jsonwebtoken');
var randtoken = require('rand-token')
const bcrypt = require('bcryptjs');
const http = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');
const unless = require('express-unless');
const rTracer = require('cls-rtracer')
const perfy = require('perfy');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const msgServerError = "Internal server error"
const consolelog = true // en/dis console logging

const crypto = require('crypto');
const cryptokey = Buffer.from(config_data.crypto.password,config_data.crypto.encoding)

const path = require('path');
const StreamZip = require('node-stream-zip');

const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

//var listenport = process.env.NODE_PORT //config_data.appConfig.listenport //TCP Listen port
var listenport = config_data.appConfig.listenport //TCP Listen port
var tokenproperties = config_data.tokenproperties  //Token
var refreshTokens = {}

var server = http.createServer(app).listen(listenport, '127.0.0.1',function(){
  var port = server.address().port
  console.log("CerveAPI Backup server listening on port %s", port)
});


// =======================Var initialize  END =======================
//======================= router config  =======================
/*Routers:
	- rTracer : manage unique ID logging row for parallel processing
	- app.use(req,res,next) : logging, makes body parameter name case insensitive
	- checkJWT : check token. This middleware use "unless" module to exclude specific requests
	- cacheMiddleware : cache manager. This middleware use "unless" module to exclude specific requests 
*/

var corsOptions = {
  origin: ["https://backup.roncola.net","http://localhost:8080"]
};
app.use(cors(corsOptions));

app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(rTracer.expressMiddleware()) // keeps unique ID for each request
app.use(bodyParser.json());
app.use((req, res, next) => {
	srvconsoledir(req) 								//log every request
	req.body = new Proxy(req.body, {  // case insensitive parameter name
    get: (target, name) => target[Object.keys(target)
			.find(key => key.toLowerCase() === name.toLowerCase())]	
	}) 
	next();
});

checkJWT.unless = unless;   //use "unless" module to exclude specific requests for CheckJWT 

app.use(checkJWT.unless({
  path: ['/login','/weblogin','/auth/token','/downloadupdateengine','/BackupPS','/BackupConfig','/restore','/cancelAction']
}))

//======================= router config end

//======================= functions
function checkJWT(request, response, next) { //Function used by Router to verify token
  if (request.headers.authorization) { 			 // check headers params
    console.log (request.headers.authorization)
    jwt.verify(request.headers.authorization, tokenproperties.secret, function (err, decoded) {  // check valid token
      if (err) {
        consoledir("CheckJWT failed: not authorized");
        response.statusMessage = 'You are not authorized';
        return response.status(401).send('You are not authorized')
      } else { 
        console.log (decoded);
        next()}
    })
  } else {
		consoledir("CheckJWT failed: not authorized");
    response.statusMessage = 'You are not authorized';
    return response.status(401).send('You are not authorized')//json({message:'You are not allowed'})
  }
}

function srvconsoledir(request, start=1, err = 0){ //internal: log service call info to console
	let splitted = request.path.split('/')
	let srvname = splitted[1]
  let params = ""
  if (err==0){
		if (start){
      if (Object.keys(request.body).length != 0){
        params = JSON.stringify(request.body)
        if (['login','weblogin'].includes(srvname)){params = 'user: ' + request.body.user}
      }else{
        params = JSON.stringify(request.query)
      }
			consoledir(`${srvname} service request from ${request.connection.remoteAddress} : ${params}`)
      perfy.start(rTracer.id())
		}
		else{
			let perfSecs = perfy.end(rTracer.id())['time']
			let perfMsg = `${perfSecs} secs`
			if ((config_data.log.thresholdProcessTimeWarning < perfSecs) && (perfSecs < config_data.log.thresholdProcessTimeAlert)) {perfMsg = `${perfMsg} LatencyWarning` }
			else if (perfSecs > config_data.log.thresholdProcessTimeAlert) {perfMsg = `${perfMsg} LatencyAlert` }
			consoledir(`${srvname} service completed for ${request.connection.remoteAddress} in ${perfMsg}`)}}
	else{
		consoledir(`${srvname} service requested from ${request.connection.remoteAddress} raised this error: ${JSON.stringify(err)}`)
		perfy.end(rTracer.id())
		}
}

function consoledir(logmsg){ //Internal: log to console
	var currentDate = new Date();
	var date = leadingZero(currentDate.getDate());
	var month = leadingZero(currentDate.getMonth()+1); 
	var year = currentDate.getFullYear();
	var mdy  = `${date}/${month}/${year}`;
	var hour = leadingZero(currentDate.getHours());
	var minute = leadingZero(currentDate.getMinutes());
	var second = leadingZero(currentDate.getSeconds());
	let ms = leadingZero(currentDate.getMilliseconds())
	var hms  = `${hour}:${minute}:${second}.${ms}`;
	if (consolelog){
		console.dir(`${rTracer.id()} - ${mdy} ${hms} - ${logmsg}`)
}}

function leadingZero(num){ //Internal: add zero char on string
	return (num < 10 ? '0' : '') + num;
}

function niceBytes(x){ //include a decimal point and a tenths-place digit if presenting less than ten of KB or greater units
	let l = 0, n = parseInt(x, 10) || 0;
	while(n >= 1024 && ++l)
		n = n/1024;
	return(`${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`);
  }

function encrypt(text,key,iv) {
    let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex')+encrypted.toString('hex'); //put IV as header of crypted msg
}

function decrypt(text,key) {
    let ivstring = text.substring(0,32) //IV expected 32 chars (16bytes) in msg header
    let iv = Buffer.from(ivstring, 'hex'); //transform IV string to bytes
    let encryptedstring = text.substring(32) //msg starts at 33rd position
    let encrypted = Buffer.from(encryptedstring, 'hex'); //transform msg string to bytes
    let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv); //initialize decipher obj
    let decrypted = decipher.update(encrypted); //decrypt body multiple of blocksize
    decrypted = Buffer.concat([decrypted, decipher.final()]); //decrypt queue = less than blocksize
    return decrypted;//.toString(); //convert bytes to string
}

function restoreDB(computerId, filename, next ){
  const dumpname = config_data.appConfig.dumpfilename
  const tmpdumpfile = path.join(__dirname+'/../tmp/tmpdumpfile.sql')
  //get dbname from bkpfolder table using computerid
  store.getbkpFolder(computerId, function(err, destfolder, dbname){
    if(!err && destfolder != "" && dbname != ""){
        const zippath = config_data.appConfig.importrootpath+'/'+destfolder+'/'+filename
        const zip = new StreamZip({
          file: zippath,
          storeEntries: true
        })
        zip.on('ready', () => {
          let dumpcontent = zip.entryDataSync(dumpname).toString('utf8'); //extract dump from bkpfilename
          fs.writeFileSync(tmpdumpfile , dumpcontent)
          store.restoreBackup(dbname, tmpdumpfile, (errmsg, result) => {
            if(!errmsg && result){
              consoledir(`Restore of ${zippath} on DB ${dbname} was succesfull`)
              next(null,true)
            }else{
              consoledir(`Restore of ${zippath} on DB ${dbname} failed!`)
              next(errmsg,false)
            }
            //fs.unlinkSync(tmpdumpfile)
          });
        })
    }else{
      consoledir(`Error while restoring DB : can't retrieve bkpfolder`)
      next(err, false)
    }
  })
}


const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
//  ======================= internal functions END ======================= 

//  ======================= Services  =======================

app.post(['/login','/weblogin'],function(req, res) {  // Login Service
  var username = req.body.user,
    password = req.body.password;
  
  var role = req.url === '/login'?'api':'web'
  store.login(username,password, role, function (err, loginmsg) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (err) {
      srvconsoledir(req,0,err)
      res.status(500).send({ message: msgServerError})
    }else{
      if (loginmsg === 'ok'){
        consoledir(`Login OK for user ${username} : sending Token that will expire in ${Math.round(tokenproperties.tokenTimeout / 36)/100} hours`);
        var token = jwt.sign({ id: username, role: role }, tokenproperties.secret, {
          expiresIn: tokenproperties.tokenTimeout // expires in 24 hours
        });
        var refreshToken = randtoken.uid(256)
        refreshTokens[refreshToken] = username  
        res.status(200).send({ auth: true, token: token, refresh_token: refreshToken});
      }else{ //if((loginmsg === 'disabled') or (loginmsg === 'notfound')){
        consoledir(`Login failed: user ${username} not allowed`);
        res.status(401).send({ auth: false});
        //res.status(401).json({message:'You are not allowed'});
      }
    }  
  })
})

app.post('/auth/token', function (req, res) {
  var username = req.body.user
  var role = req.body.role
  var refreshToken = req.body.refresh_token
  if((refreshToken in refreshTokens) && (refreshTokens[refreshToken] == username)) {
    var token = jwt.sign({ id: username, role: role }, tokenproperties.secret, {
      expiresIn: tokenproperties.tokenTimeout
    });
    consoledir(`Token refreshed for user ${username} : sending new token that will expire in ${Math.round(tokenproperties.tokenTimeout / 36)/100} hours`);
    res.status(201).send({ auth: true, token: token})
  }
  else {
    consoledir(`Refresh token not available for user ${username}`);
    res.status(401).send({ auth: false});
  }
})

app.post('/restore', function(req, res){
  if (req.body.computerId === null) {
    return res.status(500).send('ComputerId is missing')
  }
  store.getLastComputerBackup(req.body.computerId, (err,filename) => {
    if (req.body.filename != null) filename = req.body.filename
    if (!err && filename != "") {
      restoreDB(req.body.computerId, filename, (err, result) => {
        if (result) return res.status(200).send(`Restore of backupfile ${filename} was succesfull`)
        else return res.status(500).send(`Restore of backupfile ${filename} failed: ` + err)
      })
    }else return res.status(500).send(`Restore of backupfile ${filename} failed: ` + err)
  })
})



app.post('/upload', function(req, res) {
	if (Object.keys(req.files).length == 0) {
    //Log -> no files for computer
    return res.status(400).send('false');
	}
	//name of the input field used to retrieve the uploaded file
	let importFile = req.files.bkpfile;
  let destfolder = "";
  //CerveBackup v.1.0
  if (req.body.destfolder != null){
    destfolder = capitalize(req.body.destfolder);
    savefile(destfolder, importFile, function(err, saveresult){
      if (!err) return res.status(200).send(saveresult);
      return res.status(500).send(saveresult);
    })
  }
  store.computerGet(req.body.cn,req.body.sn,req.body.vendor,req.body.site, function(err, computerId){
    if (!err){
      if(computerId != 0){
        store.getbkpFolder(computerId, function(err, destfolder){ 
          if(!err){
            if (destfolder != ""){            
              savefile(destfolder, importFile, function(err, filename, containsDump){
                if (!err){
                  store.saveLog(computerId,"Backup complete", function(err){
                    if (err) consoledir("Log saved error: " + err);
                  })
                  store.addBackup(computerId,filename,containsDump, function(err){
                    if (err) consoledir("Error while adding backup to DB: " + err);
                  })
                  //restore backup
                  restoreDB(computerId, filename, (err, result) => {
                    if (result)   return res.status(200).send(`Restore of backupfile ${filename} was succesfull`)
                    else          return res.status(500).send(`Restore of backupfile ${filename} failed: ` + err)
                    })
                }else{
                  return res.status(500).send(filename); //Log -> error while saving backup for computer
                }  
              })
            }else{
              return res.status(500).send("Can't retreive save destination folder") //Log -> Can't retreive save destination folder for computer
            }
          }else{
            consoledir(req,0,err) //Log -> error while retreiving bkf folder for computer
            return res.status(500).send({ message: msgServerError})  
          }
        });
      }else{
        consoledir('ComputerId not found: it is possible that computer was not added by getPSAction') //Log missing computerId (?)
        return res.status(500).send('ComputerId not found')
      }
    }else{  
      consoledir('Error while retreiving computerId')
      return res.status(500).send('Error while retreiving computerId')
    }
  })  
});

function savefile(destfolder, importFile, next){
  if (fs.existsSync(config_data.appConfig.importrootpath+'/'+destfolder)){ 
    var currentDate = new Date();
    var hour = leadingZero(currentDate.getHours());
    var minute = leadingZero(currentDate.getMinutes());
    var second = leadingZero(currentDate.getSeconds());
    let ms = leadingZero(currentDate.getMilliseconds());
    var hms  = `${hour}h${minute}m${second}s${ms}ms`;
    let filename = hms+'_'+importFile.name
    let destpath = config_data.appConfig.importrootpath+'/'+destfolder+'/'+filename
    if (debugging){destpath = config_data.debug.debugimportrootpath +'/'+importFile.name}
    importFile.mv( destpath, function(err) {
      if (err) next (err,'API Error: ', false);
        consoledir(`file saved with name ${destpath}`)
        bkpcontainsDump(destpath, function(err, containsDump){
          if(!err){
            next(null,filename, containsDump);
          }else{
            next(null, filename, false);
          }
        })
      });
  }else{
    consoledir(`Folder ${fs.existsSync(config_data.appConfig.importrootpath)}/${destfolder} does not exist`)
    throw ('API Error: folder does not exist',"");
  }
}

function bkpcontainsDump(zippath, next){
  const dumpname = config_data.appConfig.dumpfilename
  const zip = new StreamZip({
      file: zippath,
      storeEntries: true
  });
  zip.on('ready', () => {
    // Take a look at the files
    let entry;
    for (entry of Object.values(zip.entries())) {
      //const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`;
      if (entry.name === dumpname){
        break
      }
    }
    zip.close()
    next(null,(entry.name === dumpname))  
    // Read a file in memory
    //let zipDotTxtContents = zip.entryDataSync('path/inside/zip.txt').toString('utf8');
    //console.log("The content of path/inside/zip.txt is: " + zipDotTxtContents);
  });
}


app.post('/uploadenc', function(req, res) {
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('false');
  }
  //name of the input field used to retrieve the uploaded file
  let importFile = req.files.bkpfile;

  //mv() method to place the file somewhere
  let destpath = config_data.appConfig.importrootpath+'/'+req.body.destfolder+'/'+req.files.bkpfile.name
  if (debugging){destpath = config_data.debug.debugimportrootpath +'/'+req.files.bkpfile.name}

  let decryptedfile = decrypt(importFile.data.toString('hex'), cryptokey)
  destpath = destpath.substring(0, destpath.length-4) //remove '.enc' from filename

  fs.writeFile(destpath, decryptedfile, function(err) {
    if (err) return res.status(500).send(err);
    res.send('true');
  });
});

app.get('/downloadupdateengine',function(req, res){

  let cn=req.query.cn
  let sn=req.query.sn
  let vendor=req.query.vendor
  let site=req.query.site

  //new update.ps1 version
  if (cn != null){ 
    consoledir ('cname='+cn+'sn='+sn+'vendor='+vendor+'site='+site);

    store.computerGet(cn,sn,vendor,site, function (err,computerid) {
      if(err){
        throw (err)
      }
      consoledir('due get compid='+computerid) 
      //computer exists verify action
      if (computerid > 0) {
        consoledir('due in getaction'+computerid)
        store.getAction(computerid, function (err, action) {
          if (err){
            throw (err)
          }
          consoledir('action = '+action)
          if (action === 'updupd'){
            consoledir('updupd: sending file /home/marco/NodeJS/App/CerveRemoteUpdate.ps1')
            res.sendFile('/home/marco/NodeJS/App/CerveRemoteUpdate.ps1');
          }else{
            consoledir('no action defined')
            res.connection.destroy();
          }
        })
      //computer does not exists verify customer, license then add it
      }else{
        store.computerAdd(cn,sn,vendor,site,function(err, computerid){
          if(err){
            throw(err)
          }
          consoledir('added compid='+computerid)
        })
      }
    })
  }else{
    consoledir('Received request from oldupdate: sending official upd')
    res.sendFile('/home/marco/NodeJS/App/Official/CerveRemoteUpdate.ps1');
  }
  
});

app.get('/psaction', function(req, res){
  let cn=req.query.cn
  let sn=req.query.sn
  let vendor=req.query.vendor
  let site=req.query.site
  if (req.query.ack){
    store.ackPSAction(cn,sn,vendor,site, function (err){
      if(!err) consoledir(`PSaction acknowledged and pulled from queue`)
      else consoledir(`Error while acknowledging pscompaction: ${err}`)
      return res.status(200).send("ok")
    })
  }else{
    store.getPSAction(cn,sn,vendor,site, function (err, psaction) {
      if(!err && (psaction != "")){
        consoledir(`PSAction sent to client`)
        return res.status(200).send(psaction)
      }else{
        consoledir('No PSAction in queue for this computer')
        return res.status(200).send("exit 0")
      }
    })
  }
})

app.get('/BackupPS',function(req, res){
  res.sendFile('/home/marco/NodeJS/App/CerveRemoteBackup.ps1');

});

app.get('/BackupConfig',function(req,res){
  res.sendFile(`/home/marco/NodeJS/App/BackupCerve.config`);
});

app.get('/backuplog', function(req, res){
  store.getbackupLog('super',req.query.action,(err, rows) => {
    return res.status(200).send(rows);
  })
})

app.post('/requestAction', function(req, res){
	if (req.body.computerId === null) {
		return res.status(500).send('ComputerId is missing')
	}
	if (req.body.action === null) {
		return res.status(500).send('Action is missing')
	}
	store.requestAction(req.body.computerId, req.body.action, (err, rres) => {
    if(err){
      return res.status(500).send(`Request of action ${req.body.action} for ${req.body.computerId} failed: ` + err)
      }else if (rres === null) return res.status(500).send(`psaction ${req.body.action} not valid`)
      else if (rres === 0) return res.status(500).send(`computerid ${req.body.computerId} not valid`)
      else{
      return res.status(200).send(`ok:${rres}`)
    }
	})
})


app.post('/cancelAction', function(req, res){
	if (req.body.computerId === null) {
		return res.status(500).send('ComputerId is missing')
	}
	if (req.body.action === null) {
		return res.status(500).send('Action is missing')
	}
	store.cancelAction(req.body.computerId, req.body.action, (err, rres) => {
    if(err){
      return res.status(500).send(`Cancel action for ${req.body.computerId} failed: ` + err)
    } else if (rres === null) return res.status(500).send(`Computer action not valid`)
      else                    return res.status(200).send(`ok:${rres}`)
	})
})




