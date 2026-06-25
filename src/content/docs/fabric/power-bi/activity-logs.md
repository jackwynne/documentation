---
title: Activity Logs
description: Retrieve the ViewReport logs for a given workspace
lang: en
---

**Note, you will have to be a Power BI Administrator to run these commands**

To retrieve the ViewReport logs for a given workspace copy the following script into a file:

```powershell
param
(
    [Parameter(Mandatory, HelpMessage = 'Please provide a workspace to filter for')]
    $WorkspaceId,
    [Parameter(Mandatory, HelpMessage = 'Please provide a json file to write to')]
    $OutputFile,
    $Days = 30,
    $ActivityType = 'ViewReport'
)

Login-PowerBIServiceAccount

$Result = New-Object -TypeName "System.Collections.ArrayList"
$day = Get-date
for ($s = 0; $s -le $Days; $s++) {
    $periodStart = $day.AddDays(-$s)
    $base = $periodStart.ToString("yyyy-MM-dd")

    Get-PowerBIActivityEvent -StartDateTime ($base + 'T00:00:00.000') -EndDateTime ($base + 'T23:59:59.999') -ActivityType 'ViewReport' -ResultType JsonString | ConvertFrom-Json  | Where-Object { ($_.WorkspaceId -eq $WorkspaceId) } | Foreach-Object { 
        $Result += $_
    }
}
Write-Output $Result | ConvertTo-Json | Out-File $OutputFile
```

And call it like this:
```powershell
pwsh .\get-log.ps1 -OutputFile log.json -WorkspaceId "{{workspace guid}}"
```