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
            welcomeBackground: 'assets/images/default/welcome-background.jpg', // Imagen para la pantalla de bienvenida
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
                background-color: rgba(38, 102, 40, 0.53);
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
        `;
        document.head.appendChild(style);
    }

    showWelcomePanel() {
        // Solo establecer el fondo, sin crear panel
        this.setWelcomeBackground();
    }
    
    hideWelcomePanel() {
        // Elimina la clase del body que podría ocultar elementos
        document.body.classList.remove('welcome-active');
    }
    
    setWelcomeBackground() {
        // Usar una imagen específica para cuando no hay instancias seleccionadas
        const backgroundUrl = this.defaultAssets.welcomeBackground;
        
        const img = new Image();
        img.onload = () => {
            document.body.style.setProperty('background-image', `url('${backgroundUrl}')`, 'important');
            document.body.style.setProperty('background-size', 'cover', 'important');
            document.body.style.setProperty('background-position', 'center', 'important');
            document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
            document.body.style.setProperty('background-color', 'rgba(0, 0, 0, 0.4)', 'important');
            document.body.style.setProperty('background-blend-mode', 'overlay', 'important');
        };
        
        img.onerror = () => {
            // Fallback a la imagen de fondo por defecto si hay error
            document.body.style.setProperty('background-image', `url('${this.defaultAssets.background}')`, 'important');
        };
        
        img.src = backgroundUrl;
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
                    // Ya no necesitamos ocultar un panel, pero mantenemos la llamada
                    // para mantener consistencia con el código existente
                    this.hideWelcomePanel();
                    
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
                    document.body.style.setProperty('background-blend-mode', 'normal', 'important');
                    document.body.style.setProperty('background-color', 'transparent', 'important');
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