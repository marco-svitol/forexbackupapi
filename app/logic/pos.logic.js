//const db = require("../database").pool;
const appConfig = require("../config/app.config.js");
const store = require("../database");
const jwt = require('jsonwebtoken');
var tokenproperties = appConfig.tokenproperties  //Token
const logger=require('../logger');  
const fs = require('fs');
const path = require('path');
const StreamZip = require('node-stream-zip');



//  =======================  functions  ======================= 
function leadingZero(num){ //Internal: add zero char on string
	return (num < 10 ? '0' : '') + num;
}

function restoreDB(computerId, filename, next ){
  const dumpname = appConfig.dumpfilename
  const tmpdumpfile = path.join(process.cwd()+'/'+appConfig.tmpfolder+'/../tmp/tmpdumpfile.sql')
  //get dbname from bkpfolder table using computerid
  store.getbkpFolder(computerId, function(err, destfolder, dbname){
    if(!err && destfolder != "" && dbname != ""){
        const zippath = path.join(process.cwd()+'/'+appConfig.importrootpath+'/'+destfolder+'/'+filename)
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

function sortfilesbydate(folder, next){
  try{
    fs.readdir(folder, function(err, files){
      files = files
      .map(function (fileName) {
        return {
          name: folder + '/' + fileName,
          time: fs.statSync(folder + '/' + fileName).mtime.getTime()
        };
      })
      .sort(function (a, b) {
        return a.time - b.time; })
      .map(function (v) {
        return v.name; });
      next(null, files)
      });
    
  }catch{
    next (err, null)
  }
}

function savefile(destfolder, importFile, next){
  if (fs.existsSync(appConfig.importrootpath+'/'+destfolder)){ 
    //order all files by date and delete filex with index greater than 8
    sortfilesbydate(process.cwd()+'/'+appConfig.importrootpath+'/'+destfolder, (err, files) =>{
      if (!err){
        logger.debug(`Found ${files.length} DB backups`)
        for (var i = 0; i<= files.length - appConfig.maxDBBackuptokeep ; i++){
          logger.verbose(`Deleting ${files[i]}`)
          fs.unlinkSync(files[i])
        }
      }else{
        logger.error(`Error while rotating backups: ${err}`)
      }
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
    })
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

/* const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
} */
//  ======================= functions END ======================= 

//  ======================= Services  =======================

//deprecated
exports.login = (req, res) => {  // Login Service
  var username = req.body.user,
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
        res.status(200).send({ auth: true, token: token});
      }else{
        logger.warn(`Login failed for user ${username}: ${lresult.message}`);
        res.status(401).send({ auth: false});
      }
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
                      res.status(200).send(`true`)
                      store.runcompare(computerId, (err, compres) =>{
                        if(!err && compres){
                          logger.info(`Compare of balance for computerId ${computerId} completed`)
                        }else{
                          logger.error(`Compare of balance for computerId ${computerId} failed ${err}`)
                        }
                      })
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

exports.psaction = (req, res) => { 
  let cn=req.query.cn
  let sn=req.query.sn
  let vendor=req.query.vendor
  let site=req.query.site
  let mcftver = req.query.v
  if (mcftver){
    store.saveMCFTver(cn,sn,vendor,site, mcftver, function(err, computerid){
      if(!err && computerid != 0) logger.info(`Saved MCForecTalk version for computerid ${computerid}: ${mcftver}`)
      else {
        computerid==0?logger.error(`Error while saving MCForecTalk version: computerid not found`):logger.error(`Error while saving MCForecTalk version: ${err}`)
      }
    })
  }
  if (req.query.ack){
    store.ackPSAction(cn,sn,vendor,site, function (err, computerid){
      if (err){
        logger.error(`Error while acknowledging pscompaction: ${err}`)
        return res.status(500).send("false")
      }
      if(computerid != 0){
        logger.info(`PSaction acknowledged and pulled from queue`)
        return res.status(200).send(`true`)
      }else{
        logger.error(`Error while acknowledging pscompaction: computerid not found`)
        return res.status(400).send("computerid not found")
      }
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
