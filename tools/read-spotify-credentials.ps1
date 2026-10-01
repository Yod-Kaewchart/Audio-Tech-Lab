# Internal backend pipe only. Do not run this script in an interactive console.
$ErrorActionPreference = 'Stop'
try {
    $credentialFile = Join-Path $env:LOCALAPPDATA 'AudioTechLab\spotify.clixml'
    $credential = Import-Clixml -LiteralPath $credentialFile
    if ($credential -isnot [System.Management.Automation.PSCredential]) { throw 'Invalid credential store' }
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    @{ clientId = $credential.UserName; clientSecret = $credential.GetNetworkCredential().Password } | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine('Unable to read Spotify credential store for this Windows user.')
    exit 1
}
