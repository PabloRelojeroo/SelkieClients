class InstanceAssetsHandler {
    constructor() {
        this.baseUrl = 'https://pablo.pablorelojerio.online/files';
        this.defaultAssets = {
            logo: 'assets/images/default/default-logo.png',
            background: 'assets/images/background.png',
            icon: 'assets/images/icon.png'
        };
        this.addGlobalStyles();
    }

    addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .instance-logo-container {
                transition: transform 0.3s ease, opacity 0.3s ease;
                opacity: 0.8;
            }

            .instance-logo-container:hover {
                transform: scale(1.1);
                opacity: 1;
            }

            .instance-logo-container.active-instance {
                opacity: 1;
                transform: scale(1.05);
            }

            .instance-logo {
                transition: filter 0.3s ease;
            }

            .instance-logo-container:not(.active-instance) .instance-logo {
                filter: grayscale(50%);
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

        console.log('Logo path:', customization.logo); // Debug
        const logoUrl = customization.logo ? 
            this.buildAssetUrl(instance.name, customization.logo) : 
            this.defaultAssets.logo;
        console.log('Constructed logo URL:', logoUrl); // Debug

        return {
            logo: logoUrl,
            background: backgroundUrl
        };
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

    createLogoElement(instance, onClick) {
        const container = document.createElement('div');
        container.classList.add('instance-logo-container', 'slide-in');
        container.id = `logo-${instance.name}`;

        const img = document.createElement('img');
        img.classList.add('instance-logo');
        img.alt = instance.customization?.name_display || instance.name;
        img.loading = 'lazy';
        img.style.width = '48px';
        img.style.height = '48px';

        const { logo } = this.getInstanceAssets(instance);
        console.log('Logo URL final:', logo); // Debug

        if (instance.customization?.name_display) {
            container.setAttribute('title', instance.customization.name_display);
        }

        img.onerror = (error) => {
            console.warn(`Error al cargar el logo para ${instance.name}:`, error);
            img.src = this.defaultAssets.logo;
        };

        img.src = logo;

        container.appendChild(img);
        
        if (onClick) {
            container.addEventListener('click', async () => {
                const previousActive = document.querySelector('.active-instance');
                if (previousActive) {
                    previousActive.classList.remove('active-instance');
                }
                container.classList.add('active-instance');
                
                try {
                    await this.updateInstanceBackground(instance);
                    console.log('Fondo actualizado exitosamente');
                } catch (error) {
                    console.error('Error al actualizar el fondo:', error);
                }
                
                onClick(instance);
            });
        }

        return container;
    }
}

export default InstanceAssetsHandler;