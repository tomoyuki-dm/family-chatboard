#!/bin/sh
set -e

mkdir -p /data/uploads
chown -R www-data:www-data /data

exec apache2-foreground
