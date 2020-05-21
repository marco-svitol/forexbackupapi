//const db = require("../database").pool;
const appConfig = require("../config/app.config.js");
const store = require("../database");
const jwt = require('jsonwebtoken');
var randtoken = require('rand-token')
var tokenproperties = appConfig.tokenproperties  //Token
const logger=require('../logger');  
const fs = require('fs');
//const fileUpload = require('express-fileupload');
const path = require('path');
const StreamZip = require('node-stream-zip');

//app.use(fileUpload());

//  =======================  functions  ======================= 
function leadingZero(num){ //Internal: add zero char on string
	return (num < 10 ? '0' : '') + num;
}

function restoreDB(computerId, filename, next ){
  const dumpname = appConfig.dumpfilename
  const tmpdumpfile = path.join(__dirname+'/'+appConfig.tmpfolder+'/../tmp/tmpdumpfile.sql')
  //get dbname from bkpfolder table using computerid
  store.getbkpFolder(computerId, function(err, destfolder, dbname){
    if(!err && destfolder != "" && dbname != ""){
        const zippath = appConfig.importrootpath+'/'+destfolder+'/'+filename
        const zip = new StreamZip({
          file: zippath,
          storeEntries: true
        })
        zip.on('ready', () => {
          let dumpcontent = zip.entryDataSync(dumpname).toString('utf8'); //extract dump from bkpfilename
          fs.writeFileSync(tmpdumpfile , dumpcontent)
          store.restoreBackup(dbname, tmpdumpfile, (errmsg, msg, result) => {
            if(!errmsg && result){
              next(null,true)
            }else{
              next(errmsg,false)
            }
          });
        })
    }else{
      logger.error(`Error while restoring DB : can't retrieve bkpfolder`)
      next(err, false)
    }
  })
}

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
//  ======================= functions END ======================= 

//  ======================= Services  =======================

//deprecated
exports.login = (req, res) => {  // Login Service
  var username = req.body.username,
  password = req.body.password;
  if (username == null || password == null || username == '' || password ==''){return res.status(400).send("Bad request, check params please")}
  store.login(username,password, "api", function (err, lresult) {
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

exports.restore = (req, res) => { 
  if (req.body.computerId === null) {
    logger.error('ComputerId is missing')
    return res.status(500).send('ComputerId is missing')
  }
  store.getLastComputerBackup(req.body.computerId, (err,filename) => {
    //filename cato be restored can be passed as argument...(?). If that's the case it overrides lastbackup filename 
    if (req.body.filename != null) filename = req.body.filename
    if (!err && filename != "") {
      restoreDB(req.body.computerId, filename, (err, result) => {
        if (result) {
          logger.info(`Restore of backupfile ${filename} was succesfull`)
          return res.status(200).send(`Restore of backupfile ${filename} was succesfull`)
        }else{
          logger.error(`Restore of backupfile ${filename} failed: ${err}`)
          return res.status(500).send(`Restore of backupfile ${filename} failed`)
        }
      })
    }else{
      logger.error(`Restore of backupfile ${filename} failed:  ${err}`)
      return res.status(500).send(`Restore of backupfile ${filename} failed`)
    }
  })
}

exports.upload = (req, res) => { 
	if (Object.keys(req.files).length == 0) {
    //Log -> no files for computer
    return res.status(400).send('false');
	}
	//name of the input field used to retrieve the uploaded file
	let importFile = req.files.bkpfile;
  //deprecated
  store.computerGet(req.body.cn,req.body.sn,req.body.vendor,req.body.site, function(err, computerId){
    if (!err){
      if(computerId != 0){
        store.getbkpFolder(computerId, function(err, destfolder){ 
          if(!err){
            if (destfolder != ""){            
              savefile(destfolder, importFile, function(err, filename, containsDump){
                if (!err){
                  store.saveLog(computerId,"Backup complete", function(err){
                    if (err) logger.error(`Log saved error: ${err}`);
                  })
                  store.addBackup(computerId,filename,containsDump, function(err){
                    if (err) logger.error(`Error while adding backup to DB: ${err}`);
                  })
                  //restore backup
                  restoreDB(computerId, filename, (err, result) => {
                    if (result) {
                      logger.info(`Restore of backupfile ${filename} was succesfull`)
                      return res.status(200).send(`Restore of backupfile ${filename} was succesfull`)
                    }else{
                      logger.error(`Restore of backupfile ${filename} failed: ${err}`)
                      return res.status(500).send(`Restore of backupfile ${filename} failed`)
                    }
                  })
                }else{
                  logger.error(`Error while saving backup file: ${err}`)
                  return res.status(500).send(filename); 
                }  
              })
            }else{
              logger.error(`Can't retreive save destination folder for computer`)
              return res.status(500).send("Can't retreive save destination folder") 
            }
          }else{
            logger.error(`Error while retreiving bkf folder for computer: ${err}`) //Log -> 
            return res.status(500).send({ message: "Can't save file. Please check server logs."})  
          }
        });
      }else{
        logger.error('ComputerId not found: it is possible that computer was not added by getPSAction') //Log missing computerId (?)
        return res.status(500).send('ComputerId not found')
      }
    }else{  
      logger.error('Error while retreiving computerId')
      return res.status(500).send('Error while retreiving computerId')
    }
  })  
};

function savefile(destfolder, importFile, next){
  if (fs.existsSync(appConfig.importrootpath+'/'+destfolder)){ 
    var currentDate = new Date();
    var hour = leadingZero(currentDate.getHours());
    var minute = leadingZero(currentDate.getMinutes());
    var second = leadingZero(currentDate.getSeconds());
    let ms = leadingZero(currentDate.getMilliseconds());
    var hms  = `${hour}h${minute}m${second}s${ms}ms`;
    let filename = hms+'_'+importFile.name
    let destpath = appConfig.importrootpath+'/'+destfolder+'/'+filename
    
    importFile.mv( destpath, function(err) {
      if (err) next (err,'API Error: ', false);
        logger.debug(`file saved with name ${destpath}`)
        bkpcontainsDump(destpath, function(err, containsDump){
          if(!err){
            next(null,filename, containsDump);
          }else{
            next(null, filename, false);
          }
        })
      });
  }else{
    logger.error(`Folder ${fs.existsSync(appConfig.importrootpath)}/${destfolder} does not exist`)
    throw ('API Error: folder does not exist',"");
  }
}

function bkpcontainsDump(zippath, next){
  const dumpname = appConfig.dumpfilename
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
  });
}

exports.psaction = (req, res) => { 
  let cn=req.query.cn
  let sn=req.query.sn
  let vendor=req.query.vendor
  let site=req.query.site
  if (req.query.ack){
    store.ackPSAction(cn,sn,vendor,site, function (err){
      if(!err) logger.info(`PSaction acknowledged and pulled from queue`)
      else logger.error(`Error while acknowledging pscompaction: ${err}`)
      return res.status(200).send("ok")
    })
  }else{
    store.getPSAction(cn,sn,vendor,site, function (err, psaction) {
      if(!err && (psaction != "")){
        logger.info(`PSAction sent to client`)
        return res.status(200).send(psaction)
      }else{
        logger.verbose('No PSAction in queue for this computer')
        return res.status(200).send("exit 0")
      }
    })
  }
}
