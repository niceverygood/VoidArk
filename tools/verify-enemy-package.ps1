param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=Split-Path $PSScriptRoot -Parent
$plan=Get-Content -LiteralPath (Join-Path $projectRoot 'enemy-asset-plan.json') -Raw | ConvertFrom-Json
$manifest=Get-Content -LiteralPath (Join-Path $projectRoot 'public/assets/meshy/manifest.json') -Raw | ConvertFrom-Json
$archive=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
$sha=[Security.Cryptography.SHA256]::Create()
$entries=@()
try {
 $names=@{};foreach($item in $archive.Entries){if($names.ContainsKey($item.FullName)){throw "Duplicate ZIP entry: $($item.FullName)"};$names[$item.FullName]=$item}
 $mappingEntry=$names['VOID-ARK-enemy-3D/manifest.json'];if(!$mappingEntry){throw 'Missing package manifest'}
 $reader=[IO.StreamReader]::new($mappingEntry.Open());try{$mapping=$reader.ReadToEnd()|ConvertFrom-Json}finally{$reader.Dispose()}
 if(@($mapping.assets.PSObject.Properties).Count -ne $plan.assets.Count){throw 'Package mapping count mismatch'}
 foreach($asset in $plan.assets){
  $source=$manifest.assets.($asset.id);$mapped=$mapping.assets.($asset.id)
  if(!$mapped -or $mapped.status -ne 'ready' -or $mapped.taskId -ne $source.taskId -or $mapped.planet -ne $asset.planet -or $mapped.role -ne $asset.role){throw "Package mapping mismatch: $($asset.id)"}
  foreach($kind in @('model','preview')){
   $relative=if($kind -eq 'model'){'models/'+$asset.id+'.glb'}else{'previews/'+$asset.id+'.png'}
   $mappedPath=if($kind -eq 'model'){$mapped.url}else{$mapped.thumbnail};if($mappedPath -ne $relative){throw "Invalid mapped path: $($asset.id)"}
   $entry=$names['VOID-ARK-enemy-3D/'+$relative];if(!$entry){throw "Missing ZIP entry: $relative"}
   $stream=$entry.Open();try{$zipHash=[Convert]::ToHexString($sha.ComputeHash($stream)).ToLowerInvariant()}finally{$stream.Dispose()}
   $sourceUrl=if($kind -eq 'model'){$source.url}else{$source.thumbnail}
   $file=Join-Path $projectRoot ('public'+$sourceUrl);$sourceHash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
   if($zipHash -ne $sourceHash){throw "Package content mismatch: $relative"}
   $entries+=@{file=$relative;bytes=$entry.Length;sha256=$zipHash}
  }
 }
} finally {$sha.Dispose();$archive.Dispose()}
$report=@{checkedAt=[DateTime]::UtcNow.ToString('o');archive=(Resolve-Path -LiteralPath $ArchivePath).Path;archiveSHA256=(Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant();models=$plan.assets.Count;checkedFiles=$entries.Count;entries=$entries;scope='ZIP GLB/PNG bytes and planet-role-task mapping vs current public assets; runtime assembly code is not included in this asset package'}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $projectRoot 'qa/enemy-package-integrity.json') -Encoding utf8
@{models=$report.models;checkedFiles=$report.checkedFiles;archiveSHA256=$report.archiveSHA256}|ConvertTo-Json -Compress
