$TaskPrefixBackup = "CerveBackup_"
$SchTime = "11:30"
try{
	$Action = New-ScheduledTaskAction -Execute 'C:\Program Files\PowerShell\6\pwsh.exe' -Argument "-NonInteractive -NoLogo -NoProfile -File `"$(Split-Path 	$MyInvocation.MyCommand.Path)\CerveRemoteBackup.ps1`"" 
	$Trigger = New-ScheduledTaskTrigger -Daily -At $SchTime -RandomDelay (New-TimeSpan -Minutes 15)
	$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10)  -StartWhenAvailable -WakeToRun
	$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings

    $ExSched = Get-ScheduledTask "$TaskPrefixBackup*" -ErrorAction SilentlyContinue
    $BackupTask = (Register-ScheduledTask -TaskName "$TaskPrefixBackup$(get-date -UFormat %s)" -InputObject $Task -user "NT AUTHORITY\SYSTEM" -ErrorAction stop)
    
    if ($null -ne $ExSched){
        foreach($taskname in $exsched.taskname){
            Unregister-ScheduledTask -TaskName "$($TaskName)" -Confirm:$false -ErrorAction SilentlyContinue
        }
    }
    Start-ScheduledTask $BackupTask.TaskName	
	Invoke-RestMethod -uri "$APIUrl/$APIPSAction/?cn=$($hostname)&sn=$($serialnumber)&vendor=$($manufacturer)&site=$($BP.Configuration.Site.Name)&ack=1" -Method Get -Headers $headers -SkipCertificateCheck
}
catch{}
