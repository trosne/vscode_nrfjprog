'use strict';
import * as vscode from 'vscode';
import * as subprocess from 'child_process';

enum CommandState {
    UNVERIFIED,
    OK,
    PROGRAM_NOT_FOUND,
    WRONG_VERSION
}

const errorStrings = [
    "Extension not active.",
    "OK",
    "Couldn't find nrfjprog.",
    "Wrong version of nrfjprog. The plugin requires version 9.0 and up."
]

const deviceFilterOptions = { prompt: 'Apply a device filter', placeHolder: 'e.g. 680...'};

let gCommandState: CommandState = CommandState.UNVERIFIED;

function getDeviceFamily(serialNumber: string): string {
    let config = vscode.workspace.getConfiguration('nRF5xTools');
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

function nrfjprog(args: string[]): Promise<string> {
    let config = vscode.workspace.getConfiguration('nRF5xTools');
    let nrfjprog = <string> config.get('command');
    return execute(nrfjprog + ' ' + args.join(' '))
}

function program(hexfile: string, device: string, eraseAll?: boolean): Promise<string> {
    let cmd: string[] = ['--program', hexfile, '-s', device, '-f', getDeviceFamily(device)];
    if (eraseAll) 
        cmd.push('--chiperase');
    else
        cmd.push('--sectorerase');
    return nrfjprog(cmd);
}

function erase(device: string): Promise<string> {
    return nrfjprog(['-e', '-s', device, '-f', getDeviceFamily(device)]);
}

function reset(device: string): Promise<string> {
    return nrfjprog(['-r', '-s', device, '-f', getDeviceFamily(device)]);
}

function verifyCommandState(): Promise<CommandState> {
    return nrfjprog(['--version']).then(output => {
        try {
            if (output.match(/nrfjprog version: ([\d.]+)/)[1] < '9.0.0')
                return Promise.resolve(CommandState.WRONG_VERSION);
            else
                return Promise.resolve(CommandState.OK);
        } catch (error) {
                return Promise.resolve(CommandState.WRONG_VERSION);
        }
    }, _ => Promise.resolve(CommandState.PROGRAM_NOT_FOUND));
}

function getDevices(filter?: string): Promise<string[]> {
    return nrfjprog(['-i']).then((stdout) => {
        let devices = stdout.trim().split(/\r?\n/).filter(value => (!filter || value.startsWith(filter))).map(value => value.trim());
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
    let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('nRF5xTools');
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

function resetDevice() {
    selectDevice().then(device => {
        if (device) {
            reset(device).then(() => { 
                vscode.window.setStatusBarMessage('Device reset.', 2000);
            });
        }
    }).catch(reason => {vscode.window.showErrorMessage(reason);});
}
/*************************************************************************************************/
function selectDeviceMultiple(): Thenable<string[]> {
    return vscode.window.showInputBox(deviceFilterOptions).then(filter => getDevices(filter));
}

function successMultiple(action: string, deviceCount: number) {
    let msg = action + ' ' + deviceCount + ' device';
    if (deviceCount > 1) msg += 's';
    msg += '.'
    vscode.window.setStatusBarMessage(msg, 2000);
}

function programMultiple() {
    let deviceCount = 0;
    selectDeviceMultiple().then((devices: string[]) => {
            return selectHexfile().then(hexfile => {
                return Promise.all(devices.map(device => {
                    return program(hexfile, device).then(() => {deviceCount++;}).catch(output => {
                        vscode.window.showErrorMessage(device + ': ' + output);
                    });
                }));
            });
        }).then(() => {
            successMultiple('Programmed', deviceCount);
        }, output => {vscode.window.showErrorMessage(output)});
}

function eraseMultiple() {
    let deviceCount = 0;
    selectDeviceMultiple().then((devices: string[]) => {
            return Promise.all(devices.map(device => {
                return erase(device).then(() => {deviceCount++});
            }));
        }).then(() => {
            successMultiple('Flash erased on', deviceCount);
        }, output => {vscode.window.showErrorMessage(output)});
}

function resetMultiple() {
    let deviceCount = 0;
    selectDeviceMultiple().then((devices: string[]) => {
            return Promise.all(devices.map(device => {
                return reset(device).then(() => {deviceCount++});
            }));
        }).then(() => {
            successMultiple('Reset', deviceCount);
        }, output => {vscode.window.showErrorMessage(output)});
}

function executeIfCommandStateIsOK(command: ()=>void) {
    if (gCommandState == CommandState.OK) 
        command();
    else
        vscode.window.showErrorMessage(errorStrings[gCommandState]);
}

export function activate(context: vscode.ExtensionContext) {
    verifyCommandState().then(state => {
        gCommandState = state;

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.program', () => {
            executeIfCommandStateIsOK(programDevice);
        }));

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.programMultiple', () => {
            executeIfCommandStateIsOK(programMultiple);
        }));

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.erase', () => {
            executeIfCommandStateIsOK(eraseDevice);
        }));

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.eraseMultiple', () => {
            executeIfCommandStateIsOK(eraseMultiple);
        }));

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.reset', () => {
            executeIfCommandStateIsOK(resetDevice);
        }));

        context.subscriptions.push(vscode.commands.registerCommand('nRF5xTools.resetMultiple', () => {
            executeIfCommandStateIsOK(resetMultiple);
        }));
    });

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(_ => {
        verifyCommandState().then(state => gCommandState = state);
    }))
}

export function deactivate() {
}