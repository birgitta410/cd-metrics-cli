# cd-metrics-cli

CLI to pull data from git repos and CD pipelines (currently only supports "Gitlab CI/CD"). Spits out a series of change and deployment events that can be analysed by [this spreadsheet](https://docs.google.com/spreadsheets/d/1Va8uzeeUhaS3Am59vuPF8oE6VvQljVCEJUF1Q3y_WT8/edit?usp=sharing).

## Project setup
```
npm install
```

## Run CLI
Needs environment variables `GITLAB_URL` and `GITLAB_TOKEN`
```
./cd-metrics.sh
```

Example for `throughput`:
```
./cd-metrics.sh throughput -p 1111 --repo ssh://...clone-url-for-repo.git --since 2019-10-01 --until 2020-02-24 -j name_of_our_prod_deployment_job
```

Example for `stability`:
```
./cd-metrics.sh stability -p 2222 --repo ssh://...clone-url-for-repo.git --since 2019-10-01 --until 2020-02-24 -b develop integration master
```

## Use the spreadsheet

Paste the results of the "throughput" and "stability" commands, respectively, into the yellow areas of the spreadsheet.

## Build and test
### Build Docker image
```
docker build -t cd-metrics-cli .
```

### Run CLI with Docker image
Needs environment variables `GITLAB_URL` and `GITLAB_TOKEN`
```
./cd-metrics.sh run-docker
```

### Run unit tests
```
npm run test:unit
```

### Build Docker image
```
docker build --tag cd-metrics-cli:latest .
```
