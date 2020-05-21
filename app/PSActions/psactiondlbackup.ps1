$ec = $error.count
Invoke-WebRequest -Uri "$APIUrl/BackupPS" -outfile "$(Split-Path $MyInvocation.MyCommand.Path)\CerveRemoteBackup.ps1"  -SkipCertificateCheck
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}