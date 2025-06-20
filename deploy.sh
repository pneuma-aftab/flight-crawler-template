#!/bin/bash

programname=$0
function usage {
    echo ""
    echo "Builds and deploys image to kubernetes cluster."
    echo ""
    echo "usage: $programname --project string --namespace string --version string"
    echo ""
    echo "  --project string        name of the project/app"
    echo "                          (example: reward-seat-tracker, crawler/aadvantage)"
    echo "  --version string        version of the image to deploy"
    echo "                          (example: 0.0.1)"
    echo "  --namespace string      namespace of the cluster"
    echo "                          (example: dev, staging)"
    echo "  --browser              use browser-based Dockerfile"
    echo ""
}

function die {
    printf "Script failed: %s\n\n" "$1"
    exit 1
}

while [ $# -gt 0 ]; do
    if [[ $1 == "--help" ]]; then
        usage
        exit 0
    elif [[ $1 == "--browser" ]]; then
        browser=true
        shift
        continue
    elif [[ $1 == "--"* ]]; then
        v="${1/--/}"
        declare "$v"="$2"
        shift
    fi
    shift
done

############################################################
# Help                                                     #
############################################################


if [[ -z $project ]]; then
    usage
    die "Missing parameter --project"
elif [[ -z $version ]]; then
    usage
    die "Missing parameter --version"
elif [[ -z $namespace ]]; then
    usage
    die "Missing parameter --namespace"
fi

############################################################
############################################################
# Main program                                             #
############################################################
############################################################

# Set variables
version=${version:-"0.0.1"}
project=${project:-"0.0.1"}
registryUrl="registry-prod.pneuma.club"
namespace=${namespace:-"dev"}

set -e

# Set Dockerfile path based on --browser flag
if [[ $browser == true ]]; then
    dockerfile="./docker/apps/browser-crawler/production/Dockerfile"
else
    dockerfile="./docker/apps/browserless-crawler/production/Dockerfile"
fi

echo "Building Image $registryUrl/crawlers/$project:$version..."
sudo docker build -t $registryUrl/crawlers/$project:$version --build-arg PROJECT="$project" -f $dockerfile .

echo "Pushing Image $registryUrl/crawlers/$project:$version..."
sudo docker push $registryUrl/crawlers/$project:$version

echo "Deploying crawler..."
helm upgrade --install -f ./helm/apps/$project/values.yaml -n $namespace $project --set image.tag=$version ./helm/charts/crawler