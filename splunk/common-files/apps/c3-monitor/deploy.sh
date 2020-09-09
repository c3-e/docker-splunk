#!/usr/bin/env bash

# Bump Version in apps.conf
VERSION=$(cat default/app.conf | grep version | sed 's/version = //')
NEXT_VERSION=$(echo $VERSION | awk -F. -v OFS=. 'NF==1{print ++$NF}; NF>1{if(length($NF+1)>length($NF))$(NF-1)++; $NF=sprintf("%0*d", length($NF), ($NF+1)%(10^length($NF))); print}')

echo "Bumping version from $VERSION to $NEXT_VERSION"
sed -i '' -e s/$VERSION/$NEXT_VERSION/ default/app.conf
cat default/app.conf

# Package c3-monitor as tar.gz file
cd .. && rm -rf *.tar.gz
echo "Packaging c3-monitor application"
tar -czf c3-monitor-$NEXT_VERSION.tar.gz c3-monitor
FILE=$(ls c3-monitor*.tar.gz)

# Upload c3-monitor to S3
aws s3 cp $FILE s3://c3.internal.development.file.repository/file-repo/files/
rm -rf *.tar.gz