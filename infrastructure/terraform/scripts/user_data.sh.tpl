#!/bin/sh
set -eu

cat >/etc/motd <<MOTD
${project_name} ${environment} application host
Managed by Terraform. Use SSM Session Manager for administrative access.
MOTD
