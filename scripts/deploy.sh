# deploy script for the project submodules

SCRIPT_DIR=$(dirname "$0")
echo "$SCRIPT_DIR"
PIPELINE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$PIPELINE_DIR" || exit

npm install

cdk deploy
