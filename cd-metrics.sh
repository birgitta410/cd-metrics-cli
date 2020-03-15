#!/usr/bin/env bash
set -e

DIR=$(pwd)
repoRemotePath=""
repoName=""

get_repo_argument() {
    repoValueNext=0    
    for arg in "$@"
    do
        if [ "$repoValueNext" -eq 1 ]; then
            repoRemotePath=$arg
            repoValueNext=0
            echo "Repo: ${repoRemotePath}"
        fi
        if [ "$arg" == "--repo" ]; then
            repoValueNext=1
        fi
    done
    
}

get_repo_name() {
    pat='\/([^\/]*)\.git'
    [[ $repoRemotePath =~ $pat ]]
    repoName="${BASH_REMATCH[1]}"    
    echo "Repo name: ${repoName}"
}

clone_or_update_repo() {
    localRepoPath="repos/${repoName}"
    if [ -d "$localRepoPath" ]; then
        echo "Pulling updates in ${localRepoPath}..."
        cd $localRepoPath
        git pull --rebase
    else
        echo "Cloning ${repoRemotePath} to ${localRepoPath}..."
        mkdir -p $localRepoPath
        cd "repos"
        git clone "${repoRemotePath}"
    fi
    cd $DIR
}

prepare_repo() {
    get_repo_argument "$@"
    if [ -z "$repoRemotePath" ]
    then
        echo "--repo not set, skipping local clone or update"
    else
        get_repo_name
        clone_or_update_repo
    fi
}

task_local() {
    if [ -z "$@" ]; then
        npm run cli -- --help
    else
        if [ "$IN_DOCKER" -ne 1 ]; then
            prepare_repo "$@"
        fi
        npm run cli -- "$@"
    fi
}

task_docker() {
    if [ -z "$@" ]; then
        echo ""
    else
        prepare_repo "$@"
    fi
    docker run -t -i --name cd-metrics-cli \
        -e GITLAB_URL -e GITLAB_TOKEN -e IN_DOCKER=1 \
        --volume $(pwd)/repos/:/usr/src/cd-metrics-cli/repos/ \
        cd-metrics-cli "$@"
    docker cp cd-metrics-cli:/usr/src/cd-metrics-cli/cd-metrics-cli-output .
    docker rm -f cd-metrics-cli
}

CMD=${1:-}
case ${CMD} in
  run-docker) shift || true && task_docker "$@" ;;
  *) task_local "$@" ;;
esac
