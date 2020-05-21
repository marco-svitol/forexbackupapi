var winston = require('winston');
const format = require('winston').format;
const moment = require('moment-timezone');
// Wrap Winston logger to print reqId in each log

//const clshooked = require('cls-hooked');
//const loggerNamespace = clshooked.getNamespace('logger');

var POSId = function() {
  return `POS:tbd`;
  //const loggerNamespace = clshooked.getNamespace('logger');
  //return `POS:${loggerNamespace.get('requestId')}`;//"99";//req.body.POSId;
};

const appendTimestamp = format((info, opts) => {
  if(opts.tz)
    info.timestamp = moment().tz(opts.tz).format('DD-MM-YYYY HH:mm:ss:SSS').trim();
  return info;
});

const myCustomLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    verbose: 'magenta'
  }
};

winston.addColors(myCustomLevels.colors);
//const deflogger = winston.createLogger({
winston.configure({  
  levels: myCustomLevels.levels,
  format: winston.format.combine(
    appendTimestamp({ tz: 'Europe/Rome' }),
    winston.format.colorize(),
    winston.format.printf(log => {
      PId = POSId();
      PId = PId?`${PId.padEnd(4,' ')} | `:'';
      msg = `${PId}${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(17, ' ')} | ${log.message}`;
      //msg = `${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(7, ' ')} | ${log.message}`;
      return msg;
    })
  ),
  transports: [
    new winston.transports.File({ filename: '../logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../logs/combined.log', level: process.env.LOGLEVEL_CONSOLE })
  ]
});

winston.add(new winston.transports.Console({
  level: process.env.LOGLEVEL_CONSOLE
  })
);

module.exports=winston;