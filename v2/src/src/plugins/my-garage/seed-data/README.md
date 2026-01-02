# Vehicle Taxonomy Seed Data

This directory contains the infrastructure for seeding vehicle taxonomy data into the My Garage plugin.

## Data Sources

### 1. NHTSA vPIC API (Primary)
- **Endpoint**: `https://vpic.nhtsa.dot.gov/api/`
- **Provides**: Makes, Models, Years (1981+)
- **Format**: JSON
- **Rate Limit**: None for public use
- **Documentation**: https://vpic.nhtsa.dot.gov/api/

### 2. Static JSON Seed Files (Fallback)
Pre-generated JSON files for offline/fallback use:
- `vehicle-makes.json` - ~150 common makes
- `vehicle-models.json` - ~5,000 models
- `vehicle-trims.json` - Common trims by model
- `vehicle-engines.json` - Engine configurations

## Scripts

### Fetch Data from NHTSA
```bash
npm run seed:vehicles:fetch
```
This fetches the latest vehicle data from NHTSA and saves it to JSON files.

### Seed Database from Files
```bash
npm run seed:vehicles
```
This imports the JSON seed files into the database.

## Data Coverage

- **Makes**: 150+ (Ford, GM, Toyota, Honda, BMW, etc.)
- **Models**: 5,000+ (covers 1995-2025 primarily)
- **Years**: 1995-2025 (30 years coverage)
- **Trims**: Common trims (Base, Sport, Limited, etc.)
- **Engines**: Common engine configurations per model

## File Structure

```
seed-data/
├── README.md              # This file
├── index.ts               # Main seed runner
├── nhtsa-fetcher.ts       # NHTSA API client
├── seed-taxonomy.service.ts  # Database import service
├── vehicle-makes.json     # Make data
├── vehicle-models.json    # Model data
├── vehicle-trims.json     # Trim data (optional)
└── vehicle-engines.json   # Engine data (optional)
```

## Updating Data

1. Run `npm run seed:vehicles:fetch` to get latest NHTSA data
2. Review the generated JSON files
3. Run `npm run seed:vehicles` to update the database

## Notes

- VIN decoding is available through NHTSA but not used for taxonomy seeding
- ACES/PIES import is handled separately through the admin UI
- The NHTSA API is free and does not require authentication
