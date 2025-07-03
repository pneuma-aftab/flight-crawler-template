# Avianca Crawler

A web crawler for searching award flight availability on Avianca LifeMiles.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env-example .env
# Edit .env with your actual values
```

3. Start the development server:
```bash
npm run start:dev
```

4. Open your browser to:
```
http://localhost:3000
```

## API Endpoints

### Flight Search
```
POST /api/flight/itinerary
```

Example request:
```json
{
  "searchParams": {
    "id": "xsbr7y6p7n3dvvro5ynys4y3",
    "journeyType": "One Way",
    "cabinClass": "Economy",
    "fromDate": "2025-07-21T00:00:00.000Z",
    "toDate": null,
    "fromDestinationType": "Airport",
    "toDestinationType": "Airport",
    "fromAirport": {
      "iataCode": "BOM"
    },
    "toAirport": {
      "iataCode": "AUH"
    },
    "fromCity": {
      "code": "BOM",
      "name": "MUMBAI",
      "country": {
        "isoCode2": "IN",
        "name": "India",
        "id": "tjntn1odzgxlq43qmihm3nnj"
      }
    },
    "toCity": {
      "code": "AUH",
      "name": "ABU DHABI",
      "country": {
        "isoCode2": "AE",
        "name": "United Arab Emirates",
        "id": "zyq1ch1gff7jj7j0abxcs0p3"
      }
    }
  },
  "providerId": "rncqd0j9uq7apv9hcwohg9jy",
  "frequentFlyerProgramId": "xzzs61vcohsb5em8v06vlfqd",
  "jobId": "d91bbefefe9ea4dff24d3ed1",
  "debug": true
}
```

### Health Check
```
GET /api/health
```

## Environment Variables

- `AVIANCA_AUTHORIZATION_CODE`: The authorization code for token refresh
- `AVIANCA_API_BASE_URL`: Base URL for Avianca API (default: https://api.lifemiles.com)
- `AVIANCA_OAUTH_BASE_URL`: Base URL for OAuth API (default: https://oauth.lifemiles.com)

## Development

The crawler follows a two-step process:
1. **Token Refresh**: Uses the authorization code to get a fresh access token
2. **Flight Search**: Uses the access token to search for flights

The authorization code needs to be refreshed periodically and stored in the environment variables.

## Notes

- The flight response schema is currently a placeholder and needs to be updated with the actual response format
- The cabin class mapping follows Avianca's numbering system (Economy: 2, Business: 1, etc.)
- Debug mode will save results to Crawlee's dataset instead of the database