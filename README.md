## Getting Started

### Prerequisites

- Docker and Docker Compose
- (Optional) Node.js 22.x and Python 3.10.19 for local development

### Running with Docker

```bash
# Build and start containers
docker-compose up --build

# Or run in detached mode
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f
```

## To-Do

- [x] Repeat playback btn
- [x] Clear selection area when switch to other song
- [x] Loading (tracks, ruler)
- [x] Upload spinner
- [ ] Start && End marker pixel perfect
- [x] Mute logo on volumn control
- [ ] Change color theme
- [ ] Allow GPU run DL model
