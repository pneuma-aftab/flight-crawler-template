# Flight Crawler Template

A comprehensive monorepo template for building airline award availability crawlers using modern web scraping techniques. This template provides a scalable architecture for crawling flight availability from various airline loyalty programs.

## 🚀 Overview

This template is designed to help developers quickly build and deploy flight availability crawlers for different airline loyalty programs. It includes:

- **Modular Architecture**: Separate apps for different airlines (American Airlines AAdvantage, Etihad Guest)
- **Shared Libraries**: Reusable components for logging, error handling, configuration, and more
- **Modern Tech Stack**: TypeScript, Hono, Crawlee, Puppeteer, and Turbo for monorepo management
- **Production Ready**: Docker support, Helm charts for Kubernetes deployment, and comprehensive error handling

## 📁 Project Structure

```
flight-crawler-template/
├── apps/                          # Airline-specific crawler applications
│   ├── aadvantage/               # American Airlines AAdvantage crawler
│   └── etihad-guest/             # Etihad Guest crawler
├── libraries/                     # Shared libraries and utilities
│   ├── builder/                  # Build utilities
│   ├── configuration-provider/   # Environment configuration
│   ├── error-handling/           # Error handling and middleware
│   ├── logger/                   # Logging utilities
│   ├── request-context/          # Request context management
│   ├── secure-headers/           # Security headers middleware
│   ├── shared-utils/             # Common utilities and types
│   └── tsconfig/                 # TypeScript configuration
├── docker/                       # Docker configurations
├── helm/                         # Kubernetes Helm charts
└── deploy.sh                     # Deployment script
```

## 🛠️ Technology Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Monorepo**: Turbo
- **Web Framework**: Hono
- **Web Scraping**: Crawlee, Puppeteer
- **Validation**: Zod
- **Logging**: Pino
- **Deployment**: Docker, Kubernetes (Helm)

## 🚀 Quick Start

### Prerequisites

- Node.js 22.0.0 or higher
- pnpm 10.7.1 or higher
- Docker (for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flight-crawler-template
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment template (if available)
   cp .env.example .env
   ```

### Development

#### Running Individual Apps

**American Airlines AAdvantage:**
```bash
cd apps/aadvantage
pnpm start:dev
```

**Etihad Guest:**
```bash
cd apps/etihad-guest
pnpm start:dev
```

#### Development Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format

# Clean workspace
pnpm clean:workspaces
```

## 🏗️ Architecture

### Apps

Each airline crawler is a separate application with its own:
- **API Routes**: RESTful endpoints for flight searches
- **Crawler Logic**: Airline-specific scraping implementation
- **Configuration**: Environment and crawler settings
- **Schema Validation**: Response validation using Zod

### Libraries

Shared libraries provide common functionality:

- **`@pneuma/logger`**: Structured logging with Pino
- **`@pneuma/error-handling`**: Centralized error handling and middleware
- **`@pneuma/configuration-provider`**: Environment configuration management
- **`@pneuma/request-context`**: Request context and ID management
- **`@pneuma/secure-headers`**: Security headers middleware
- **`@pneuma/shared-utils`**: Common utilities, types, and validators

## 🐳 Deployment

### Docker

Each app includes Docker configurations for containerized deployment:

```bash
# Build Docker image
docker build -f docker/apps/aadvantage/production/Dockerfile -t aadvantage-crawler .

# Run container
docker run -p 8000:8000 aadvantage-crawler
```

### Kubernetes (Helm)

Use the provided Helm charts for Kubernetes deployment:

```bash
# Deploy to Kubernetes
helm install etihad-guest ./helm/apps/etihad-guest
```

## 🔧 Configuration

### Environment Variables

Each app requires specific environment variables. See individual app READMEs for details:

- **AAdvantage**: `apps/aadvantage/README.md`
- **Etihad Guest**: `apps/etihad-guest/README.md`

### Crawler Configuration

Crawlers can be configured for:
- **Rate Limiting**: Control request frequency
- **Proxy Support**: Rotate IP addresses
- **User Agents**: Customize browser identification
- **Timeout Settings**: Configure request timeouts

## 📊 API Endpoints

Each crawler exposes RESTful endpoints for:

- **Flight Search**: Search for award availability
- **Health Check**: Service health monitoring
- **Job Status**: Track crawling job progress

### Example Usage

```bash
# Search for flights
curl -X POST 'http://localhost:3000/api/flight/itinerary' \
  --header 'Content-Type: application/json' \
  --data-raw '{
  "searchParams": {
    "id": "xsbr7y6p7n3dvvro5ynys4y3",
    "journeyType": "One Way",
    "cabinClass": "Economy",
    "fromDate": "2025-07-24T00:00:00.000Z",
    "toDate": null,
    "fromDestinationType": "Airport",
    "toDestinationType": "Airport",
    "fromAirport": {
        "iataCode": "LHR"
    },
    "toAirport": {
      "iataCode": "JFK"
    },
    "fromCity": {
      "code": "LON",
      "name": "LONDON",
      "country": {
        "isoCode2": "GB",
        "name": "United Kingdom",
        "id": "cvh55mhyigzl5au5krpdlzt0"
      }
    },
    "toCity": {
      "code": "NYC",
      "name": "NEW YORK",
      "country": {
        "isoCode2": "US",
        "name": "United States",
        "id": "jqmiowmemerr01t5tqhkk8zb"
      }
    }
  },
  "providerId": "rncqd0j9uq7apv9hcwohg9jy",
  "frequentFlyerProgramId": "xzzs61vcohsb5em8v06vlfqd",
    "jobId": "cfc74240ec4d07c8cd55bace",
  "debug": true
}'
```

Make sure to pass the debug flag while testing

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-airline`
3. **Make your changes**
4. **Run tests and linting**: `pnpm lint && pnpm typecheck`
5. **Commit your changes**: `git commit -m 'Add new airline crawler'`
6. **Push to the branch**: `git push origin feature/new-airline`
7. **Create a Pull Request**

### Adding a New Airline

To add support for a new airline:

1. **Create a new app directory**: `apps/new-airline/`
2. **Copy the template structure** from existing apps
3. **Implement airline-specific logic** in `src/flight-availability/`
4. **Add configuration** and environment variables
5. **Update the monorepo configuration**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions and support:

- **Issues**: Create an issue in the repository
- **Documentation**: Check individual app READMEs
- **Examples**: Review existing airline implementations

## 🔄 Version

Current version: 3.6.1

---

**Note**: This template is designed for educational and development purposes. Ensure compliance with airline terms of service and applicable laws when using web scraping techniques.
