
docker run -t -i --name cd-metrics-cli -e GITLAB_URL -e GITLAB_TOKEN cd-metrics-cli "$@"
docker cp cd-metrics-cli:/usr/src/cd-metrics-cli/cd-metrics-cli-output .
docker rm -f cd-metrics-cli