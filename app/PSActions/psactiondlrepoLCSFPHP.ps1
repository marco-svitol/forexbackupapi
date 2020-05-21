$ec = $error.count
Invoke-WebRequest -Uri "https://backup.ilciclaio.it:8000/repo/listCashStatementALLFunction.php" -outfile "C:\Program Files\typo3\htdocs\forex\portal\printModules\pdf\listCashStatementALLFunction.php"  -SkipCertificateCheck
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}