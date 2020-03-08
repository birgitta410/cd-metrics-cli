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

if [ -z "$@" ]; then
    npm run cli -- --help
else
    prepare_repo "$@"
    npm run cli -- "$@"
fi


