# cd-metrics-cli

## Project setup
```
npm install
```

### Run CLI
Needs environment variables `GITLAB_URL` and `GITLAB_TOKEN`
```
./cd-metrics.sh
```

### Build Docker image
```
docker build -t cd-metrics-cli .
```

### Run CLI with Docker image
Needs environment variables `GITLAB_URL` and `GITLAB_TOKEN`
```
./cd-metrics-docker.sh
```

### Run unit tests
```
npm run test:unit
```
