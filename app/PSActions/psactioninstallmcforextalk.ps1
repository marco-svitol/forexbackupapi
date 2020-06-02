$ec = $error.count
Invoke-WebRequest -Uri "https://mondialchange.roncola.net/mcforextalksilentt3.exe" -outfile "$env:temp\mcforextalksilentt3.exe" 
Start-Process -Wait -FilePath "$env:temp\mcforextalksilentt3.exe" -ArgumentList "/S" -passthru
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers 
}