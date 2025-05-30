/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
import DiscordRPC from './discord-rpc.js';
import InstanceAssetsHandler from './InstanceAssetsHandler.js';

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.rpc = new DiscordRPC();
        await this.rpc.init();
        this.assetsHandler = new InstanceAssetsHandler();
        await this.loadInstanceAssets(); // Cargar assets iniciales
        this.socialLick()
        this.instancesSelect()
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))
    }

    async loadInstanceAssets() {
        const configClient = await this.db.readData('configClient');
        const auth = await this.db.readData('accounts', configClient.account_selected);
        const instancesList = await config.getInstanceList();
        
        // Crear contenedor para los logos de instancias en la sidebar
        const sidebarLogoContainer = document.createElement('div');
        sidebarLogoContainer.classList.add('sidebar-logos');
        document.querySelector('.sidebar').insertBefore(
            sidebarLogoContainer, 
            document.querySelector('.player-options')
        );
        
        // Mostrar solo el fondo de bienvenida, sin ningún panel
        this.assetsHandler.setWelcomeBackground();
        
        // Cargar todas las instancias sin seleccionar ninguna por defecto
        for (let instance of instancesList) {
            const logoElement = await this.assetsHandler.createLogoElement(
                instance,
                async (selectedInstance) => {
                    // Callback cuando se selecciona una instancia
                    const configClient = await this.db.readData('configClient');
                    configClient.instance_selct = selectedInstance.name;
                    await this.db.updateData('configClient', configClient);
    
                    // Actualizar fondo de la instancia seleccionada
                    await this.assetsHandler.updateInstanceBackground(selectedInstance);
                    
                    // Actualizar estado del servidor
                    const statusName = selectedInstance.customization?.name_display || 
                        selectedInstance.status?.nameServer ||
                        selectedInstance.name;
                    await setStatus(selectedInstance.status, statusName);
                },
                auth?.name
            );
    
            sidebarLogoContainer.appendChild(logoElement);
        }
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);
        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">No hay noticias disponibles actualmente.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Enero</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Podrás seguir todas las novedades relacionadas con el servidor aquí..</p>
                        </div>
                    </div>`
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date)
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '</br>')}</p>
                                <p class="news-author">Autor - <span>${News.author}</span></p>
                            </div>
                        </div>`
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Janvier</div>
                        </div>
                    </div>
                    <div class="news-content">a
                        <div class="bbWrapper">
                            <p>Imposible contactar con el servidor de noticias.</br>Porfavor verifique la configuracion.</p>
                        </div>
                    </div>`
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        try {
            const configClient = await this.db.readData('configClient');
            const auth = await this.db.readData('accounts', configClient.account_selected);
            const instancesList = await config.getInstanceList();
    
            // Cache DOM elements
            const elements = {
                instanceBTN: document.querySelector('.play-instance')
            };
    
            // Función auxiliar para verificar whitelist
            const checkWhitelist = (instance, username) => {
                return !instance.whitelistActive || 
                       (instance.whitelist && instance.whitelist.includes(username));
            };
    
            // Función para mostrar mensaje de whitelist
            const showWhitelistMessage = (instance) => {
                const popupError = new popup();
                popupError.openPopup({
                    title: 'Acceso Restringido',
                    content: `No tienes acceso a la instancia "${instance.name}". Esta instancia requiere estar en la lista blanca para poder jugar.`,
                    color: 'red',
                    options: {
                        confirmText: 'Entendido',
                        cancelText: null
                    }
                });
            };
    
            // Event listener para el botón de jugar
            elements.instanceBTN.addEventListener('click', async () => {
                const configClient = await this.db.readData('configClient');
                const currentInstance = instancesList.find(i => i.name === configClient.instance_selct);
                
                // Si no hay instancia seleccionada, mostrar error
                if (!currentInstance) {
                    const popupError = new popup();
                    popupError.openPopup({
                        title: 'Selecciona una instancia',
                        content: 'Debes seleccionar una instancia de Minecraft antes de jugar.',
                        color: 'orange',
                        options: {
                            confirmText: 'Entendido',
                            cancelText: null
                        }
                    });
                    return;
                }
    
                // Verificar whitelist antes de iniciar
                if (!checkWhitelist(currentInstance, auth?.name)) {
                    showWhitelistMessage(currentInstance);
                    return;
                }
    
                try {
                    await this.startGame();
                } catch (error) {
                    console.error('Error starting game:', error);
                    const popupError = new popup();
                    popupError.openPopup({
                        title: 'Error',
                        content: 'Ocurrió un error al intentar iniciar el juego. Por favor, intenta de nuevo.',
                        color: 'red',
                        options: {
                            confirmText: 'OK',
                            cancelText: null
                        }
                    });
                }
            });
    
        } catch (error) {
            console.error('Error in instancesSelect:', error);
            const popupError = new popup();
            popupError.openPopup({
                title: 'Error',
                content: 'Ocurrió un error al cargar las instancias. Por favor, reinicia el launcher.',
                color: 'red',
                options: {
                    confirmText: 'OK',
                    cancelText: null
                }
            });
        }
    }

    async startGame() {
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instance = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name == configClient.instance_selct)
    
        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')
    
        // Variables para tracking de velocidad y tiempo
        let downloadStartTime = Date.now()
        let lastProgressUpdate = Date.now()
        let lastBytesLoaded = 0
        let averageSpeed = 0
        let speedSamples = []
    
        // Crear elementos para estadísticas
        if (!document.querySelector('.download-stats')) {
            const downloadStats = document.createElement('div')
            downloadStats.classList.add('download-stats')
            downloadStats.innerHTML = `
                <div class="download-speed">0 MB/s</div>
                <div class="download-eta">Tiempo restante: Calculando...</div>
            `
            infoStartingBOX.insertBefore(downloadStats, progressBar)
            
            const percentageDisplay = document.createElement('div')
            percentageDisplay.classList.add('progress-percentage')
            percentageDisplay.textContent = '0%'
            
            const progressContainer = document.createElement('div')
            progressContainer.classList.add('progress-container')
            progressContainer.appendChild(progressBar)
            progressContainer.appendChild(percentageDisplay)
            
            infoStartingBOX.replaceChild(progressContainer, progressBar)
            
            const loadingAnimation = document.createElement('div')
            loadingAnimation.classList.add('loading-animation')
            loadingAnimation.innerHTML = '<span class="loading-dots"></span>'
            infoStartingBOX.appendChild(loadingAnimation)
        }
    
        // Referencias a los nuevos elementos
        const downloadSpeed = document.querySelector('.download-speed')
        const downloadETA = document.querySelector('.download-eta')
        const percentageDisplay = document.querySelector('.progress-percentage')
        const loadingAnimation = document.querySelector('.loading-animation')
    
        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,
    
            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type == 'none' ? false : true
            },
    
            verify: options.verify,
    
            ignored: [...options.ignored],
    
            javaPath: configClient.java_config.java_path,
    
            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },
    
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }
    
        launch.Launch(opt);
    
        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "block"
        loadingAnimation.style.display = "block"
        ipcRenderer.send('main-window-progress-load')
    
        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            console.log(extract);
            infoStarting.innerHTML = `Extrayendo archivos`
            percentageDisplay.textContent = 'Preparando...'
        });
    
        // Función para calcular el promedio de velocidad
        const calculateAverageSpeed = (newSpeed) => {
            speedSamples.push(newSpeed)
            if (speedSamples.length > 5) speedSamples.shift()
            return speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
        }
    
        // Función para formatear tiempo
        const formatTime = (seconds) => {
            if (seconds < 60) return `${Math.floor(seconds)}s`
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
            return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
        }
    
        launch.on('progress', (progress, size) => {
            if (!isNaN(progress) && isFinite(progress) && !isNaN(size) && isFinite(size) && size > 0) {
                const now = Date.now()
                const elapsedSinceLastUpdate = (now - lastProgressUpdate) / 1000 // en segundos
                
                if (elapsedSinceLastUpdate > 0.5) { // Actualizar cada 500ms para suavizar
                    const bytesLoaded = progress - lastBytesLoaded
                    const instantSpeed = bytesLoaded / elapsedSinceLastUpdate // bytes por segundo
                    
                    if (instantSpeed > 0) {
                        averageSpeed = calculateAverageSpeed(instantSpeed)
                        const speedMBps = (averageSpeed / 1048576).toFixed(2) // Convertir a MB/s
                        downloadSpeed.textContent = `${speedMBps} MB/s`
                        
                        // Calcular tiempo estimado restante
                        const remaining = size - progress
                        const eta = remaining / averageSpeed // segundos
                        
                        if (eta > 0 && eta < 100000) { // Evitar valores muy grandes por velocidades bajas iniciales
                            downloadETA.textContent = `Tiempo restante: ${formatTime(eta)}`
                        }
                    }
                    
                    lastProgressUpdate = now
                    lastBytesLoaded = progress
                }
                
                const percent = ((progress / size) * 100).toFixed(0)
                infoStarting.innerHTML = `Descargando archivos`
                percentageDisplay.textContent = `${percent}%`
                ipcRenderer.send('main-window-progress', { progress, size })
                progressBar.value = progress
                progressBar.max = size
            } else {
                console.warn("Valores de progreso inválidos:", { progress, size })
                infoStarting.innerHTML = `Descargando archivos`
                percentageDisplay.textContent = 'Preparando...'
            }
            this.rpc.updateDownloadProgress(progress, size)
        });
    
        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Verificando archivos`
            const percent = ((progress / size) * 100).toFixed(0)
            percentageDisplay.textContent = `${percent}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress
            progressBar.max = size
            
            // Ocultar estadísticas de velocidad durante la verificación
            downloadSpeed.textContent = 'Verificando...'
            downloadETA.textContent = ''
        });
    
        launch.on('estimated', (time) => {
            let hours = Math.floor(time / 3600)
            let minutes = Math.floor((time - hours * 3600) / 60)
            let seconds = Math.floor(time - hours * 3600 - minutes * 60)
            downloadETA.textContent = `Tiempo estimado: ${hours ? hours + 'h ' : ''}${minutes}m ${seconds}s`
            console.log(`${hours}h ${minutes}m ${seconds}s`)
        })
    
        launch.on('speed', (speed) => {
            const speedMBps = (speed / 1048576).toFixed(2)
            downloadSpeed.textContent = `${speedMBps} MB/s`
            console.log(`${(speed / 1067008).toFixed(2)} Mb/s`)
        })
    
        launch.on('patch', patch => {
            console.log(patch)
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `<span class="game-running">Juego en curso</span>`
            loadingAnimation.style.display = "none"
            percentageDisplay.textContent = 'Iniciando...'
            downloadSpeed.textContent = ''
            downloadETA.textContent = ''
        });
    
        launch.on('data', (e) => {
            progressBar.style.display = "none"
            loadingAnimation.style.display = "none"
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            };
            new logger('Minecraft', '#36b030')
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `<span class="game-running">Juego en curso</span>`
            console.log(e)
            this.rpc.updateForInstance(options.name)
        })
    
        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Verificación`
            new logger(pkg.name, '#7289da')
            console.log('Close')
            this.rpc.setDefault()
        });
    
        launch.on('error', err => {
            let popupError = new popup()
    
            popupError.openPopup({
                title: 'Error',
                content: err.error,
                color: 'red',
                options: true
            })
    
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Verificación`
            new logger(pkg.name, '#7289da')
            console.log(err)
        });
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'sepriembre', 'octubre', 'noviebre', 'diciembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}
export default Home;