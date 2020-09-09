# Copyright 2018 Splunk
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM registry.c3.ai/ubi7:7.8.394.2

ARG SCLOUD_URL
ENV SCLOUD_URL ${SCLOUD_URL}

COPY 6885159042732693228.pem /tmp/
RUN subscription-manager import --certificate=/tmp/6885159042732693228.pem && \
    yum-config-manager --enable rhel-7-server-rpms

COPY install.sh /install.sh
RUN /install.sh && rm -rf /install.sh /tmp/*
