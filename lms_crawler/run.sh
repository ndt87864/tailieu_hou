#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
docker run -it --rm -v "$DIR":/app -w /app --net=host node:22-alpine node lms_crawler.js
