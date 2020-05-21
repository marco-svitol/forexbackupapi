$ec = $error.count
Start-ScheduledTask -taskname (Get-ScheduledTask -TaskName "CerveBackup*").taskname
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}