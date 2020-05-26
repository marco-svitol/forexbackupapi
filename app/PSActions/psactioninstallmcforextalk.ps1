$ec = $error.count
Invoke-WebRequest -Uri "https://mondialchange.roncola.net/mcforextalks.exe" -outfile "$env:temp\mcforextalks.exe" 
Start-Process -Wait -FilePath "$env:temp\mcforextalks.exe" -ArgumentList "/S" -passthru
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers 
}