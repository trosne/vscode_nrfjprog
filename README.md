# nRF5x Tools For VS Code

A VS Code wrapper of the Nordic Semiconductor utility with the same name.

Program and erase the flash contents of Nordic Semiconductor nRF5x devices.

This extension is not developed or supported by Nordic Semiconductor.

## Features

### Program a device

Command `nRF: Program device`

Select a device and a hexfile from the current project directory, and program it. Equivalent to calling `nrfjprog --program <hexfile> --sectorerase`.

### Erase device flash contents

Command `nRF: Erase device flash`

Select a device and erase all flash contents. Equivalent to calling `nrfjprog --eraseall`.

### Reset device 

Command `nRF: Reset device`

Select a device and reset it. Equivalent to calling `nrfjprog --reset`.

### Program multiple devices

Command `nRF: Program multiple devices`

Select a device filter and a hexfile from the current project directory, and program it to all devices that match the filter.

### Erase multiple devices

Command `nRF: Erase multiple devices`

Select a device filter and erase all flash contents of all devices that match the filter.

### Reset multiple devices

Command `nRF: Reset multiple devices`

Select a device filter and reset all devices that match the filter.

### Device filters

The device filter matches against the start of the serial number, and acts on all devices that match. E.g. `680` will match devices `680191390` and `680123456`, but not `481234680`.
 
## Requirements

Requires nrfjprog from the nRF5x-Command-Line-Tools utility version 9.0.0 or higher. The extension looks for the program in its `PATH`, but the location can be overridden by setting the `nRF5xTools.nrfjprog` setting. The version and presence is checked at startup.

The nRF5x-Command-Line-Tools utility is available for [Windows](http://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-Win32/58850), [Linux](http://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-Linux64/58852) and [OSx](http://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-OSX/58855).

## Extension Settings

- `nRF5xTools.hexFolderFilter`: Path filter for finding hexfiles to flash.
- `nRF5xTools.deviceFamilyFilters`: Serial number filters for device families.
- `nRF5xTools.deviceFamilyDefault`: Default device family (`NRF51` or `NRF52`).
- `nRF5xTools.nrfjprog`: nrfjprog command location.

## Release Notes

### 1.0.0

Initial release of nrfjprog.
