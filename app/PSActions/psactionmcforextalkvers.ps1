$ec = $error.count
$vers = (Get-Item "$env:programfiles\typo3\ForexPOSService\ForexPOSService.exe").VersionInfo.ProductVersion
if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1&v=$($vers)" -Method Get -Headers $headers
}