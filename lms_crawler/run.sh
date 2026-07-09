#!/bin/bash
docker run -it --rm -v "$(pwd)":/app -w /app --net=host node:22-alpine node lms_crawler.js
