$ec = $error.count
Invoke-WebRequest -Uri "https://console.ilciclaio.it/repo/cashBalanceBookings.php" -outfile "C:\Program Files\typo3\htdocs\forex\portal\include\cashBalanceBookings.php"  -SkipCertificateCheck
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}