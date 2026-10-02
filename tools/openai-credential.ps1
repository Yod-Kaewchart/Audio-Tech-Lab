param(
    [Parameter(Mandatory=$true)][ValidateSet('write','read','delete')][string]$Action,
    [Parameter(Mandatory=$true)][string]$UserId,
    [Parameter(Mandatory=$true)][string]$Directory
)
$ErrorActionPreference = 'Stop'
if ($UserId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
    throw 'Invalid credential owner'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$directoryPath = [IO.Path]::GetFullPath($Directory)
$file = Join-Path $directoryPath ($UserId + '.clixml')

function Set-PrivateDirectoryAcl([string]$Path) {
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetOwner($identity.User)
    $acl.SetAccessRuleProtection($true, $false)
    $sids = @(
        $identity.User,
        [Security.Principal.SecurityIdentifier]'S-1-5-18',
        [Security.Principal.SecurityIdentifier]'S-1-5-32-544'
    )
    foreach ($sid in $sids) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
        )
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
switch ($Action) {
    'write' {
        $apiKey = [Console]::In.ReadToEnd().Trim()
        if ($apiKey.Length -lt 20 -or $apiKey.Length -gt 512 -or $apiKey -notmatch '^sk-[A-Za-z0-9_-]+$') {
            throw 'Invalid OpenAI credential'
        }
        New-Item -ItemType Directory -Path $directoryPath -Force | Out-Null
        Set-PrivateDirectoryAcl $directoryPath
        $secure = ConvertTo-SecureString -String $apiKey -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($UserId, $secure)
        $temporary = Join-Path $directoryPath ([guid]::NewGuid().ToString() + '.tmp')
        try {
            $credential | Export-Clixml -LiteralPath $temporary
            Move-Item -LiteralPath $temporary -Destination $file -Force
        } finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
            $secure.Dispose()
            $credential = $null
        }
        [Console]::Out.Write('{"ok":true}')
    }
    'read' {
        $credential = Import-Clixml -LiteralPath $file
        if ($credential -isnot [System.Management.Automation.PSCredential] -or $credential.UserName -ne $UserId) {
            throw 'Invalid credential store'
        }
        [Console]::Out.Write($credential.GetNetworkCredential().Password)
    }
    'delete' {
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        [Console]::Out.Write('{"ok":true}')
    }
}