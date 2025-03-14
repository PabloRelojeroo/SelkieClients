import { config, database, logger, popup } from '../utils.js';
import { appdata } from '../utils.js';

export default class InstanceCreator {
    constructor() {
        this.db = new database();
    }

    async createInstance(instanceName, version, loaderType = 'none', loaderVersion = '') {
        const configClient = await this.db.readData('configClient');
        const instancesList = await config.getInstanceList();

        // Verificar si la instancia ya existe
        if (instancesList.some(instance => instance.name === instanceName)) {
            const popupError = new popup();
            popupError.openPopup({
                title: 'Error',
                content: `La instancia "${instanceName}" ya existe.`,
                color: 'red',
                options: {
                    confirmText: 'OK',
                    cancelText: null
                }
            });
            return;
        }

        // Datos para enviar al servidor PHP
        const instanceData = {
            name: instanceName,
            version: version,
            loaderType: loaderType,
            loaderVersion: loaderVersion
        };

        try {
            // Enviar solicitud al servidor PHP para crear la instancia
            const response = await fetch('http://tu-servidor.com/files/index.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(instanceData)
            });

            if (!response.ok) {
                throw new Error('Error al crear la instancia en el servidor.');
            }

            const newInstance = await response.json();

            // Guardar la nueva instancia en la lista local
            instancesList.push(newInstance);
            await config.saveInstanceList(instancesList);

            // Notificar al usuario
            const popupSuccess = new popup();
            popupSuccess.openPopup({
                title: 'Instancia Creada',
                content: `La instancia "${instanceName}" se ha creado correctamente.`,
                color: 'green',
                options: {
                    confirmText: 'OK',
                    cancelText: null
                }
            });

            return newInstance;
        } catch (error) {
            console.error('Error al crear la instancia:', error);
            const popupError = new popup();
            popupError.openPopup({
                title: 'Error',
                content: 'Ocurrió un error al crear la instancia. Por favor, intenta de nuevo.',
                color: 'red',
                options: {
                    confirmText: 'OK',
                    cancelText: null
                }
            });
        }
    }
}