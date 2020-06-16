const appConfig = require("../config/app.config.js");
const dbConfig = require("../config/db.config.js");
const logger=require('../logger'); 
const util = require('util')
const mysql = require('mysql');
const pool = mysql.createPool(dbConfig);
const fs = require('fs');
const PSActionspath = appConfig.PSActionspath;

pool.getConnection((err, conn) => {
  if (err){
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      logger.error('Database connection was closed.')
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      logger.error('Database has too many connections.')
    }
    if (err.code === 'ECONNREFUSED') {
      logger.error('Database connection was refused.')
    }
  }
  if (conn) {
    logger.info(`Connected to ${dbConfig.database} DB on ${dbConfig.host}`)
    conn.release()
  }
  return
})

//deprecated
module.exports.computerGet = function(hostname, sn, manuf, site, next){
  let strQuery = 'call ComputerGet(?,?,?,?)'
  pool.query(strQuery, [hostname, sn, manuf, site], (err,res) => {
    if (err) {
      next(err,0)
    }else{
      if (res[0].length > 0){
        next(null,res[0][0].computerid);
      }else{
        next(null,0);
      }
    }
  })
}

//
module.exports.computerAdd = function(hostname, sn, manuf, site, next){
  let strQuery = 'call ComputerAdd(?,?,?,?)'
  pool.query(strQuery, [hostname, sn, manuf, site], (err,res) => {
    if (err) {
      next (err, 0)
    }else{
      if (res[0].length > 0){
        next(null,res[0][0].computerid);
      }else{
        next(null,0);
      }
    }
  })
}

module.exports.login = function(username, password,role, next){
  let strQuery = `select active,${role}role as warole, role from systemusers where username = ? and password = sha1(?)`
  pool.query(strQuery, [username, password], (err,res) => {
    if (err) {
      next (err, "")
    }else{
      if (res.length > 0){
        if (res[0].active[0] == 1 && res[0].warole[0] == 1){
          next(null,{success: true, role: res[0].role}  );
        }else{
          next(null,{success: false, role: res[0].role, message: "disabled"});
        }
      }else{
        next(null,{success: false, role: '', message: "not found or wrong password"});
      }
    }
  })
}

module.exports.getbkpFolder = function(computerId, next){
  let strQuery = `SELECT foldername, dbname FROM computerbkpfolder WHERE computerid = ?`
  pool.query(strQuery, [computerId], (err,res) => {
    if (err){
      next(err,"")
    }else{
      next(null,res[0].foldername, res[0].dbname)
    }
  })
}

module.exports.getAction = function(computerid, next){
  let strQuery = `SELECT action FROM computeractions WHERE computerid = ?`
  pool.query(strQuery, [computerid], (err, res) => {
    if (err) {next (err, "")
    }else{
      if (res.length > 0){
        next(null, res[0].action)
      }else{
        next(null,"")
      }
    }
  })
}

module.exports.saveLog = function(computerid, logmsg, next){
  let strQuery = `INSERT INTO computerlogs(computerid,log,CID) SELECT computerid,"${logmsg}",CID FROM computers where computerid = ?`
  pool.query(strQuery, [computerid], (err) => {
    if (err){
      next(err)
    }
    else next(null);
  })
}

module.exports.saveLogHB = function(computerid, next){ 
  let strQuery = 'call logHeartBeat(?)'
  pool.query(strQuery, [computerid], (err) => {
    if (err) {
      next (err)
    }  
  })
}

module.exports.addBackup = function(computerid, filename, containsDump, next){
  let strQuery = 'call BackupAdd(?,?,?)'
  pool.query(strQuery, [computerid,filename,containsDump], (err) => {
    if (err){
      next (err)
    }
  })
}

//deprecated add computer if does not exists
module.exports.getPSAction = function(hostname, sn, manuf, site, next){
  this.computerGet(hostname, sn, manuf, site, (err,computerid) => {
    if(err){
      throw (err)
    }
    if (computerid === 0) {
      this.computerAdd(hostname,sn,manuf,site,function(err, computerid){
        if(err) throw(err)
        logger.debug(`PSAction: added compid ${computerid}`)
      })
      next(null,"")
      return
    }else{
      //update hearbeat log
      this.saveLogHB (computerid, function(err) {
        if (err) logger.error("SaveLogHB error: " + err);
      })
      let strQuery = `SELECT psaction, psa.psactionid FROM psactions AS psa JOIN pscomputeractions psca ON psa.psactionid = psca.psactionid WHERE psca.computerid = ? AND psca.ack = 0`
      pool.query(strQuery, [computerid], (err,qres) => {
        if (err){
          next(err,"")
          return
        }else if(qres.length > 0){
          let psactionid = qres[0].psactionid;
          logger.verbose (`PSAction for computerid ${computerid} : ${psactionid}`)
          if (qres[0].psaction.substring(0,1) === '['){
            let PSfile = (qres[0].psaction.replace("[","")).replace("]","")
            fs.readFile( `${__dirname}/${PSActionspath}/${PSfile}`,function (err, data) {
              if (err) next(err);
              next(null,data.toString());
            });
          }else next(null,qres[0].psaction);
        }else{
          //No PS Action defined for this computer // console.log('err in getpsaction2')
          next(null,"")
          return
        }
      })
      //this.saveLog(computerid, logmsg , function(err){
      //  if (err) console.log("Error while savin log in getPSAction")
      //})
    }
	})
}

//deprecated use of parameters
module.exports.saveMCFTver = function(hostname, sn, manuf, site, mcftver, next){
  this.computerGet(hostname, sn, manuf, site, (err,computerid) => {
    if(err){
      next (err)
    }
    if (computerid === 0) {
      next (null, 0)
    }else{
      let strQuery = `
      INSERT INTO computerinfo (
        computerid, MCForexTalkVersion
        ) VALUES (
          ?,?
        ) 
        ON DUPLICATE KEY UPDATE
          MCForexTalkVersion = ?
        ;
      `
      pool.query(strQuery, [computerid, mcftver, mcftver], (err) => {
        if (err) next(err)
        else next(null, computerid)
      })
      //let logmsg = "PSAction: "+computerid;
      //this.saveLog(computerid, logmsg , function(err){
      //  if (err) console.log("Error while savin log in getPSAction")
      //})
    }
	})
}

//deprecated use of parameters
module.exports.ackPSAction = function(hostname, sn, manuf, site, next){
  this.computerGet(hostname, sn, manuf, site, (err,computerid) => {
    if(err){
      next (err, 0)
    }
    if (computerid === 0) {
      //throw ("ackPSAction: can't find computer")
      next(null,0)
    }else{
      let strQuery = `UPDATE pscomputeractions as psca SET ack = 1, timestamp = current_timestamp() WHERE psca.computerid = ? AND psca.ack = 0`
      pool.query(strQuery, [computerid], (err) => {
        if (err) next(err, computerid)
        else next(null, computerid)
      })
      //let logmsg = "PSAction: "+computerid;
      //this.saveLog(computerid, logmsg , function(err){
      //  if (err) console.log("Error while savin log in getPSAction")
      //})
    }
	})
}

module.exports.getbackupLog = function(user,action='',  next){
  let strquery = `call getbackuplog( ?,? )`
  pool.query(strquery, [user, action], (err ,res) => {
    if(!err && res) next(null, res[0])
    else {
      if (err) next(err,null)
      else next(null, null)
    }     
  })
}

module.exports.restoreBackup = function(dbname, dumpfilename, next){
  const {exec} = require('child_process');
  exec(`/usr/bin/mysql -u ${dbConfig.user} -p${dbConfig.password} ${dbname} < ${dumpfilename}`, (error, stdout, stderr) => {
    msg = ''
    if (error) {
        return next(error,'',false);
    }
    if (stderr) {
        msg = stderr;
    }
    msg += ` .${stdout}`;
    return next(null,msg,true);
  });
}

module.exports.getLastComputerBackup = function(computerId, next){
  let strquery = `call getLastComputerBackup( ? )`
  pool.query(strquery, [computerId], (err, res) => {
    if(!err && res[0]) next(null, res[0][0].filename)
    else {
      if (err) next(err, "")
      else next(null,"")
    }
  })
}

module.exports.requestAction = function(computerId, action, next){
  let strQuery = `call psActionAdd(?,?)`
  pool.query(strQuery, [computerId, action], (err, res) => {
    if(!err){
      var sqlRes = res[0][0]
      if (!(sqlRes.psactionId || sqlRes.computerId || sqlRes.computeractionId)) {
        return next(null, null) //psaction not found
      }else if(sqlRes.psactionId && !sqlRes.computerId){
        return next(null, 0) //computerid not found
      }
      else return next(null, sqlRes.computeractionId) //new action created
    }
    else next(err, null) //error
  })
}

module.exports.cancelAction = function(computerId, action, next){
  let strQuery = `call psActionCancel(?,?)`
  pool.query(strQuery, [computerId, action], (err, res) => {
    if(!err){
      var sqlRes = res[0][0]
      if (!sqlRes.computeractionId) return next(null, null) //computer action not found
      else return next(null, sqlRes.computeractionId) //computer action cancelled
    }
    else next(err, null) //error
  })
}

module.exports.runcompare = function(computerId, next){
  let strQuery=''
  computerId != null?strQuery = `call ${process.env.CONSOLEDBNAME}.pcpCompareCashBkp(?)`:strQuery = `call ${process.env.CONSOLEDBNAME}.pcpCompareCashBkpAll()`
  pool.query(strQuery, [computerId], (err, res) => {
    if(!err){
      if (res.length > 1){
        let strQuery = `
          INSERT INTO ${process.env.DBNAME}.balancecompare (
            computerid,\`1\`,\`2\`,\`3\`,\`25\`,\`30\`,\`31\`,\`1c\`,\`2c\`,\`3c\`,\`25c\`,\`30c\`,\`31c\`,\`LastTrans\`
            ) VALUES (
              ?,?,?,?,?,?,?,?,?,?,?,?,?,?
            ) 
            ON DUPLICATE KEY UPDATE
            \`1\`=?,\`2\`=?,\`3\`=?,\`25\`=?,\`30\`=?,\`31\`=?,\`1c\`=?,\`2c\`=?,\`3c\`=?,\`25c\`=?,\`30c\`=?,\`31c\`=?,\`LastTrans\`=?
            ;
          `
        pool.query(strQuery, [
          computerId,
          res[1][0]?res[1][0].Total:0,
          res[1][1]?res[1][1].Total:0,
          res[1][2]?res[1][2].Total:0,
          res[1][3]?res[1][3].Total:0,
          res[1][4]?res[1][4].Total:0,
          res[1][5]?res[1][5].Total:0,
          res[2][0]?res[2][0].Total:0,
          res[2][1]?res[2][1].Total:0,
          res[2][2]?res[2][2].Total:0,
          res[2][3]?res[2][3].Total:0,
          res[2][4]?res[2][4].Total:0,
          res[2][5]?res[2][5].Total:0,
          res[0][0].LastTrans,
          res[1][0]?res[1][0].Total:0,
          res[1][1]?res[1][1].Total:0,
          res[1][2]?res[1][2].Total:0,
          res[1][3]?res[1][3].Total:0,
          res[1][4]?res[1][4].Total:0,
          res[1][5]?res[1][5].Total:0,
          res[2][0]?res[2][0].Total:0,
          res[2][1]?res[2][1].Total:0,
          res[2][2]?res[2][2].Total:0,
          res[2][3]?res[2][3].Total:0,
          res[2][4]?res[2][4].Total:0,
          res[2][5]?res[2][5].Total:0,
          res[0][0].LastTrans
          ]
          ,(err) => {
            if (err) next(err)
            else next(null, true)
            strQuery = `
              SELECT (\`1\`=\`1c\` AND \`2\`=\`2c\` AND \`3\`=\`3c\` AND \`25\`=\`25c\` AND \`30\`=\`30c\` AND \`31\`=\`31c\`) 
              FROM balancecompare WHERE computerid = ? INTO @compres;
              INSERT INTO computerinfo (
                computerid, MCForexTalkVersion, ConsoleCashCompare
                ) VALUES (
                  ?,'',@compres
                ) 
                ON DUPLICATE KEY UPDATE
                ConsoleCashCompare = @compres
                ;
            `
            pool.query(strQuery, [computerId,computerId], (err) => {
              if (err) logger.error(`Error while updating ConsoleCashCompare of computerinfo: ${err}`)
            })
        })
      }else next(null, false)
    }
    else next(err) 
  })
}

pool.query = util.promisify(pool.query)

module.exports.pool = pool;