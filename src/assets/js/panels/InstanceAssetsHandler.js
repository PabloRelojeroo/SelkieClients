/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

class InstanceAssetsHandler {
    constructor() {
        this.baseUrl = 'https://pablo.pablorelojerio.online/files';
        this.defaultAssets = {
            logo: 'assets/images/default/default-logo.png',
            background: 'assets/images/default/default-background.png',
            icon: 'assets/images/icon.png'
        };
        this.addGlobalStyles();
    }

    buildAssetUrl(instanceName, assetPath) {
        if (!assetPath) return null;
        
        if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
            return assetPath;
        }
        
        if (assetPath.startsWith('assets/')) {
            return assetPath;
        }

        return `${this.baseUrl}/${assetPath}`;
    }

    getInstanceAssets(instance) {
        const customization = instance.customization || {};
        
        const backgroundUrl = customization.background && typeof customization.background === 'string' ? 
            this.buildAssetUrl(instance.name, customization.background) : 
            this.defaultAssets.background;

        const logoUrl = customization.logo ? 
            this.buildAssetUrl(instance.name, customization.logo) : 
            this.defaultAssets.logo;

        return {
            logo: logoUrl,
            background: backgroundUrl
        };
    }

    addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .instance-logo-container {
                transition: all 0.3s ease;
                opacity: 0.8;
                position: relative;
                padding: 8px;
                border-radius: 8px;
                margin: 4px 0;
                background-color: transparent;
            }

            .instance-logo-container:hover:not(.disabled):not(.active-instance) {
                opacity: 1;
                background-color: rgba(76, 175, 80, 0.1);
            }

            .instance-logo-container.active-instance {
                opacity: 1;
                background-color: rgba(76, 175, 80, 0.2);
                pointer-events: none;
            }

            .instance-logo {
                transition: filter 0.3s ease;
                width: 48px;
                height: 48px;
            }

            .instance-logo-container:not(.active-instance) .instance-logo {
                filter: grayscale(50%);
            }

            .instance-logo-container.disabled {
                opacity: 0.4;
                cursor: not-allowed;
                pointer-events: none;
            }

            .instance-logo-container.disabled::after {
                content: '🔒';
                position: absolute;
                top: 0px;
                right: 0px;
                font-size: 14px;
            }

            .welcome-screen {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9));
                z-index: 1000;
                color: white;
                text-align: center;
                animation: fadeIn 0.5s ease;
                backdrop-filter: blur(5px);
            }

            .welcome-content {
                background: rgba(255, 255, 255, 0.1);
                padding: 2em;
                border-radius: 15px;
                max-width: 80%;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            .welcome-screen h1 {
                font-size: 2.5em;
                margin-bottom: 0.5em;
                color: #4CAF50;
            }

            .welcome-screen p {
                font-size: 1.2em;
                margin-bottom: 2em;
                max-width: 600px;
                line-height: 1.6;
            }

            .welcome-screen button {
                padding: 12px 24px;
                font-size: 1.1em;
                cursor: pointer;
                background-color: #4CAF50;
                border: none;
                border-radius: 5px;
                color: white;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .welcome-screen button:hover {
                background-color: #45a049;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }

            .welcome-screen button:active {
                transform: translateY(0);
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideIn {
                from { transform: translateY(-10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            .fade-in {
                animation: fadeIn 0.5s ease forwards;
            }

            .slide-in {
                animation: slideIn 0.5s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }

    showWelcomeScreen() {
        const welcomeScreen = document.createElement('div');
        welcomeScreen.classList.add('welcome-screen');
        
        const welcomeContent = document.createElement('div');
        welcomeContent.classList.add('welcome-content');
        welcomeContent.innerHTML = `
            <h1>¡Bienvenido al Launcher!</h1>
            <p>Para comenzar, selecciona una instancia de Minecraft desde la barra lateral izquierda.<br>
            Las instancias disponibles se mostrarán con un ícono activo, mientras que las instancias bloqueadas
            tendrán un indicador de candado.</p>
            <button id="welcome-continue">Entendido</button>
        `;
        
        welcomeScreen.appendChild(welcomeContent);
        document.body.appendChild(welcomeScreen);

        // Establecer el fondo por defecto inmediatamente
        document.body.style.setProperty('background-image', `url('${this.defaultAssets.background}')`, 'important');
        document.body.style.setProperty('background-size', 'cover', 'important');
        document.body.style.setProperty('background-position', 'center', 'important');
        document.body.style.setProperty('background-repeat', 'no-repeat', 'important');

        document.getElementById('welcome-continue').addEventListener('click', () => {
            welcomeScreen.style.opacity = '0';
            setTimeout(() => welcomeScreen.remove(), 500);
        });
    }

    async createLogoElement(instance, onClick, username) {
        const container = document.createElement('div');
        container.classList.add('instance-logo-container');
        container.id = `logo-${instance.name}`;

        // Verificar whitelist
        const isWhitelisted = !instance.whitelistActive || 
            (instance.whitelist && instance.whitelist.includes(username));

        if (!isWhitelisted) {
            container.classList.add('disabled');
            container.title = 'No tienes acceso a esta instancia';
        }

        const img = document.createElement('img');
        img.classList.add('instance-logo');
        img.alt = instance.customization?.name_display || instance.name;
        img.loading = 'lazy';

        const { logo } = this.getInstanceAssets(instance);

        if (instance.customization?.name_display) {
            container.setAttribute('title', instance.customization.name_display);
        }

        img.onerror = () => {
            console.warn(`Error al cargar el logo para ${instance.name}`);
            img.src = this.defaultAssets.logo;
        };

        img.src = logo;
        container.appendChild(img);
        
        if (onClick && isWhitelisted) {
            container.addEventListener('click', async () => {
                // Si ya está activa, no hacemos nada
                if (container.classList.contains('active-instance')) {
                    return;
                }

                const previousActive = document.querySelector('.active-instance');
                if (previousActive) {
                    previousActive.classList.remove('active-instance');
                }
                container.classList.add('active-instance');
                
                try {
                    await this.updateInstanceBackground(instance);
                    onClick(instance);
                } catch (error) {
                    console.error('Error al actualizar el fondo:', error);
                }
            });
        }

        return container;
    }

    async updateInstanceBackground(instance) {
        console.log('Actualizando fondo para instancia:', instance.name);
        
        return new Promise((resolve, reject) => {
            const { background } = this.getInstanceAssets(instance);
            console.log('URL del fondo:', background);

            const img = new Image();
            
            img.onload = () => {
                console.log('Imagen de fondo cargada exitosamente');
                document.body.style.opacity = '0';
                setTimeout(() => {
                    document.body.style.setProperty('background-image', `url('${background}')`, 'important');
                    document.body.style.setProperty('background-size', 'cover', 'important');
                    document.body.style.setProperty('background-position', 'center', 'important');
                    document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
                    document.body.style.setProperty('transition', 'opacity 0.5s ease', 'important');
                    document.body.style.opacity = '1';
                }, 300);
                resolve();
            };

            img.onerror = (error) => {
                console.warn(`Error al cargar el fondo para la instancia ${instance.name}:`, error);
                document.body.style.setProperty('background-image', `url('${this.defaultAssets.background}')`, 'important');
                reject(error);
            };

            img.src = background;
        });
    }
}

export default InstanceAssetsHandler;