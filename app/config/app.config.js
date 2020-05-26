module.exports = {
	"certpath": "../certs/ilciclaio512.crt",
	"privkeypath" : "../certs/ilciclaio_sha512.key",
	"certpw" : "",
	"listenport" : 8100,
	"importrootpath" : process.env.IMPORTROOTPATH,
	//"importrootpath" : "../../backup/db/MondialChange/forex",
	"dbusertable" : "cvusers",
	"tmpfolder" : process.env.TMPFOLDER,
	"dumpfilename"  : process.env.DUMPFILENAME,
	"maxDBBackuptokeep" : 7,
	"PSActionspath": process.env.PSACTIONPATH,
	"tokenproperties": {
		"secret" : process.env.TOKENSECRET,
		"tokenTimeout": 10000,
    "refresh_tokenTimeout" : 360000
	}
}
