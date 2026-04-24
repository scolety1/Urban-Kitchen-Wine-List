# Urban Kitchen Wine List Run Policy

## Profile

Use `frontend-static-demo`.

This is a static wine list site intended for in-person showing.

## Build / Check

Build directory:
`.`

Check command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\codex-static-check.ps1
```

## First Proof Run

```powershell
cd C:\Dev\codex-fleet
.\run-checkpoint-loop.ps1 -Project UrbanKitchenWineList -BatchSize 1 -MaxBatches 1
```

## School Run

After the first proof passes:

```powershell
.\run-checkpoint-loop.ps1 -Project UrbanKitchenWineList -BatchSize 2 -MaxBatches 4
```

## Stop Conditions

Stop if the static check fails, repo is dirty after a run, forbidden files change, package/dependency files change, backend/auth/payment/API/new analytics/tracking appears, wine copy becomes generic or misleading, or Help Me Decide becomes confusing.

## Human Review

Before merging, inspect mobile first screen, wine list cards, filters/search, Help Me Decide flow, selected wine detail, no-results state, and restaurant info area.

This ship should not merge until it feels good enough to show wine people.
