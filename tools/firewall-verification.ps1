function Confirm-AtlFirewallProfiles {
    # ActiveStore includes the effective policy, including applicable GPOs.
    $profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore -ErrorAction Stop)
    foreach ($name in @('Domain', 'Private', 'Public')) {
        $match = @($profiles | Where-Object { $_.Name -eq $name })
        if ($match.Count -ne 1 -or "$($match[0].Enabled)" -ne 'True' -or
            "$($match[0].DefaultInboundAction)" -ne 'Block') {
            throw "Firewall verification failed for $name"
        }
    }
}
