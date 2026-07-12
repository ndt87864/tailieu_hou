#!/bin/bash
# Dừng container đang chạy lms_crawler.js (được khởi động bởi run.sh)

CONTAINER=$(docker ps --no-trunc --filter "ancestor=node:22-alpine" --format "{{.ID}} {{.Command}}" | grep "lms_crawler.js" | awk '{print $1}')

if [ -z "$CONTAINER" ]; then
  echo "⚠️  Không tìm thấy container lms_crawler đang chạy."
  exit 0
fi

echo "🛑 Dừng container:"
echo "$CONTAINER"
docker stop $CONTAINER
echo "✅ Đã dừng."
