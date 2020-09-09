#!/bin/bash

set -e

#localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8
#export LANG=en_US.utf8

yum -y update && yum -y install wget sudo epel-release
yum -y install busybox ansible python-requests python-jmespath

# Install scloud
wget -O /usr/bin/scloud.tar.gz ${SCLOUD_URL}
tar -xf /usr/bin/scloud.tar.gz -C /usr/bin/
rm /usr/bin/scloud.tar.gz

groupadd sudo

echo "
## Allows people in group sudo to run all commands
%sudo  ALL=(ALL)       ALL" >> /etc/sudoers

# Clean
yum clean all
rm -rf /install.sh /anaconda-post.log /var/log/anaconda/*
