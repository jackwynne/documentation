---
title: Windows Subsystem for Linux
description: Getting started with WSL
lang: en
---

You can use WSL2 linked to VS Code to do node development (speeds up development since the Malware scanner does not run across the WSL2 virtual disk).

Follow the instructions here: https://docs.microsoft.com/en-us/windows/wsl/install
And here: https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl

## Quirks

### Networks

If networking isn't working (DNS resolution fails), try running the following command:

```bash
sudo chattr -i /etc/resolv.conf
sudo rm /etc/resolv.conf
sudo bash -c 'echo "nameserver 10.150.0.117" > /etc/resolv.conf'
sudo bash -c 'echo "[network]" > /etc/wsl.conf'
sudo bash -c 'echo "generateResolvConf = false" >> /etc/wsl.conf'
sudo chattr -f +i /etc/resolv.conf
```

### Git

To use your Windows credentials to access Git repos in WLS2 run the following command (a newish version of Git Bash must be install in Windows):

```bash
git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager-core.exe"
```
You may need to change the file path to wherever git credential manager is installed.

### Typescript server crashing

If when you start VSCode the Typescript server crashes you might need to increase the 'Max TS Server Memory' in VSCode.

### Azure CLI

If you need to access / log in to Azure, first install the Az CLI in Ubuntu: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=apt#option-1-install-with-one-command

The use device code login to authenticate via the browser:

```bash
az login --use-device-code
```

**I have had the best success logging into Azure with device codes using Firefox with [Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/)**
