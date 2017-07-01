'use strict';
import * as vscode from 'vscode';
import * as subprocess from 'child_process';

let deviceFilterOptions = { prompt: 'Apply a device filter', placeHolder: 'e.g. 680...'};

function getDeviceFamily(serialNumber: string): string {
    let config = vscode.workspace.getConfiguration('nrfjprog');
    let filters = <{}> config.get('deviceFamilyFilters');
    let fallback = config.get('deviceFamilyDefault') as string;
    let filterSnrs = Object.keys(filters).sort();
    for (var snr of filterSnrs) {
        if (serialNumber.startsWith(snr)) 
            return filters[snr];
    }
    return fallback;
}

function execute(cmd): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const child = subprocess.exec(cmd, {cwd: vscode.workspace.rootPath},
            (err, stdout, stderr) => err ? reject(stderr) : resolve(stdout));
    });
}

function getDevices(filter?: string): Promise<string[]> {
    return execute('nrfjprog -i').then((stdout) => {
        let devices = stdout.trim().split(/\r?\n/).filter(value => {return (!filter || value.startsWith(filter));}).map(value => {return value.trim();});
        return Promise.resolve(devices);
    });
}

async function selectDevice(): Promise<string> {
    return getDevices().then(devices => {
        switch (devices.length) {
            case 0:
                return Promise.reject('No devices connected.');
            case 1:
                return Promise.resolve(devices[0]);
            default:
                return vscode.window.showQuickPick(devices);
        }
    });
}

class Hexfile implements vscode.QuickPickItem {
    label: string;
    description: string;
    fullFilename: string;
    constructor(filename: string) {
        let matches = filename.match(/(.*)\/(.*)/);
        if (matches) {
            this.label = matches[2];
            this.description = matches[1];
        }
        else {
            this.label = filename;
            this.description = '';
        }
        this.fullFilename = filename;
    }
}

async function selectHexfile(): Promise<string> {
    let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('nrfjprog');
    return vscode.workspace.findFiles(config.get('hexFolderFilter')+'/*.hex').then<string>((uris: vscode.Uri[]): Thenable<string> => {
        switch (uris.length) {
            case 0:
                return Promise.reject('No hexfiles found.');
            case 1:
                let path = vscode.workspace.asRelativePath(uris[0].fsPath);
                vscode.window.showInformationMessage('Selected the only hexfile '+ path);
                return Promise.resolve(path);
            default:
                return vscode.window.showQuickPick(uris.map(uri => {
                        return new Hexfile(vscode.workspace.asRelativePath(uri.fsPath))
                    })
                ).then(file => {return Promise.resolve(file.fullFilename);});
        }
    },
    ()=> { return Promise.reject('Nothing selected')});
}

function program(hexfile: string, device: string, eraseAll?: boolean): Promise<string> {
    let cmd: string = 'nrfjprog --program ' + hexfile + ' -s ' + device + ' -f ' + getDeviceFamily(device);
    if (eraseAll) 
        cmd += ' --chiperase';
    else
        cmd += ' --sectorerase';
    return execute(cmd);
}

function erase(device: string): Promise<string> {
    return execute('nrfjprog -e -s ' + device + ' -f ' + getDeviceFamily(device));
}

function programDevice() {
    selectDevice().then(device => {
        if (device) {
            return selectHexfile().then(hexfile => {
                program(hexfile, device).then(() => { 
                    vscode.window.setStatusBarMessage('Device programmed.', 2000);
                }).catch(reason => {
                    vscode.window.showErrorMessage(reason);
                });
            });
        }
    }).catch(reason => {vscode.window.showErrorMessage(reason);});;
}

function eraseDevice() {
    selectDevice().then(device => {
        if (device) {
            erase(device).then(() => { 
                vscode.window.setStatusBarMessage('Device flash erased.', 2000);
            });
        }
    }).catch(reason => {vscode.window.showErrorMessage(reason);});
}

function programMultiple() {
    let deviceCount = 0;
    vscode.window.showInputBox(deviceFilterOptions).then(filter => {
        getDevices(filter).then((devices: string[]) => {
            return selectHexfile().then(hexfile => {
                return Promise.all(devices.map(device => {
                    return program(hexfile, device).then(() => {deviceCount++;}).catch(output => {
                        vscode.window.showErrorMessage(device + ': ' + output);
                    });
                }));
            });
        }).then(() => {
            let msg = 'Programmed ' + deviceCount + ' device';
            if (deviceCount > 1) msg += 's';
            msg += '.'
            vscode.window.setStatusBarMessage(msg, 2000);
        }).catch(output => {vscode.window.showErrorMessage(output)});
    });
}

function eraseMultiple() {
    let deviceCount = 0;
    vscode.window.showInputBox(deviceFilterOptions).then(filter => {
        getDevices(filter).then((devices: string[]) => {
            return Promise.all(devices.map(device => {
                return erase(device).then(() => {deviceCount++});
            }));
        }).then(() => {
            let msg = 'Flash erased on ' + deviceCount + ' device';
            if (deviceCount > 1) msg += 's';
            msg += '.'
            vscode.window.setStatusBarMessage(msg, 2000);
        }).catch(output => {vscode.window.showErrorMessage(output)});
    });
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('nrfjprog.selectDevice', () => {
        selectDevice();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('nrfjprog.program', () => {
        programDevice();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('nrfjprog.programMultiple', () => {
        programMultiple();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('nrfjprog.erase', () => {
        eraseDevice();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('nrfjprog.eraseMultiple', () => {
        eraseMultiple();
    }));
}

export function deactivate() {
}