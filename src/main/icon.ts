/// <reference types="electron-vite/node" />
import { nativeImage } from 'electron'
import iconPath from '../../build/icon.png?asset'

/** Lumi's icon (build/icon.png: the same art as the installer and the exe) for windows, the tray and notifications. */
export const appIcon = (): Electron.NativeImage => nativeImage.createFromPath(iconPath)
