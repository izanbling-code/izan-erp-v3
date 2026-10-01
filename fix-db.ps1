Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "STEP 1: Go to your Supabase browser tab right now." -ForegroundColor Yellow
Write-Host "Click the Copy icon inside the ORM (.env.local) box" -ForegroundColor Yellow
Write-Host "(or the Session Pooler box), then come back here." -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Cyan
Read-Host "Press ENTER here AFTER you have clicked Copy in Supabase"

$clip = Get-Clipboard -Raw
if ($clip -match "(postgresql://[^\s`"']+)") {
    $rawUrl = $matches[1]
    Write-Host "Found URL template: $rawUrl" -ForegroundColor Green
} else {
    Write-Host "Could not find a postgresql:// URL in your clipboard! Please try again." -ForegroundColor Red
    exit
}

$dbPass = Read-Host "STEP 2: Type your Supabase database password and press ENTER"
$encodedPass = [uri]::EscapeDataString($dbPass.Trim())

# Build clean Session Pooler URL on port 5432 with sslmode=no-verify
$finalUrl = $rawUrl.Replace("[YOUR-PASSWORD]", $encodedPass)
$finalUrl = $finalUrl -replace ":6543", ":5432"
$finalUrl = ($finalUrl -split "\?")[0] + "?sslmode=no-verify"

$envData = @(
    "NEXT_PUBLIC_SUPABASE_URL=`"https://tmyxqswvjujniftgpgdf.supabase.co`""
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`"sb_publishable_uv401L4KARK0yc-EA9IGqQ_2B4Pv2s3`""
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=`"sb_publishable_uv401L4KARK0yc-EA9IGqQ_2B4Pv2s3`""
    "DATABASE_URL=`"$finalUrl`""
    "DIRECT_URL=`"$finalUrl`""
    "POSTGRES_URL=`"$finalUrl`""
    "POSTGRES_PRISMA_URL=`"$finalUrl`""
    "POSTGRES_URL_NON_POOLING=`"$finalUrl`""
)

Set-Content -LiteralPath ".env" -Value $envData -Encoding UTF8
if (Test-Path ".env.local") {
    Set-Content -LiteralPath ".env.local" -Value $envData -Encoding UTF8
}

Write-Host "`nUpdated .env! Pushing tables to Supabase..." -ForegroundColor Green
npx prisma db push
