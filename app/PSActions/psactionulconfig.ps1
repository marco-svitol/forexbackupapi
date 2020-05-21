$ec = $error.count

#Form for uploading file.
$UploadForm = @{
    bkpfile = get-item -path "$(Split-Path $MyInvocation.MyCommand.Path)\BackupCerve.config"
    cn = $hostname
    sn = $serialnumber
    vendor = $manufacturer
    site = "CambioStella"
}
$APIUpload = "upload"
#Post Request for file upload
Invoke-RestMethod -Method post -Uri "$APIUrl/$APIUpload" -Headers $headers -form $UploadForm -SkipCertificateCheck

if ($error.Count -eq $ec) {
    Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}