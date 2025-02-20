/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { Client } = require('discord-rpc');
const clientId = '1334505672875835475'; // Replace with your Discord application ID

class DiscordRPC {
    constructor() {
        this.client = new Client({ transport: 'ipc' });
        this.startTimestamp = null;
    }

    async init() {
        try {
            await this.client.login({ clientId });
            this.startTimestamp = Date.now();
            await this.setDefault();
        } catch (error) {
            console.error('Failed to initialize Discord RPC:', error);
        }
    }

    async setDefault() {
        try {
            await this.client.setActivity({
                details: 'En el launcher',
                state: 'Seleccionando instancia',
                startTimestamp: this.startTimestamp,
                largeImageKey: 'minecraft_logo',
                largeImageText: 'Minecraft',
                instance: false
            });
        } catch (error) {
            console.error('Failed to set activity:', error);
        }
    }

    async updateForInstance(instanceName) {
        try {
            await this.client.setActivity({
                details: `Jugando ${instanceName}`,
                state: 'En el juego',
                startTimestamp: this.startTimestamp,
                largeImageKey: 'minecraft_logo',
                largeImageText: instanceName,
                instance: false
            });
        } catch (error) {
            console.error('Failed to update activity:', error);
        }
    }

    async updateDownloadProgress(progress, size) {
        const percent = ((progress / size) * 100).toFixed(0);
        try {
            await this.client.setActivity({
                details: 'Descargando archivos',
                state: `${percent}% completado`,
                startTimestamp: this.startTimestamp,
                largeImageKey: 'minecraft_logo',
                largeImageText: 'Descargando',
                instance: false
            });
        } catch (error) {
            console.error('Failed to update download progress:', error);
        }
    }

    destroy() {
        if (this.client) {
            this.client.destroy();
        }
    }
}

export default DiscordRPC;
