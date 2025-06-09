/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";
    async init(config) {
        this.config = config;
        this.db = new database();

        // Verificar si ya existe una cuenta guardada
        await this.checkExistingAccount();

        if (typeof this.config.online == 'boolean') {
            this.config.online ? this.getMicrosoft() : this.getCrack()
        } else if (typeof this.config.online == 'string') {
            if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                this.getAZauth();
            }
        }
        
        document.querySelector('.cancel-home').addEventListener('click', () => {
            document.querySelector('.cancel-home').style.display = 'none'
            changePanel('settings')
        })
    }

    async checkExistingAccount() {
        try {
            // Leer configuración del cliente
            let configClient = await this.db.readData('configClient');
            
            if (configClient && configClient.account_selected) {
                // Verificar si existe una cuenta seleccionada
                let accounts = await this.db.readData('accounts') || [];
                let selectedAccount = accounts.find(account => account.ID === configClient.account_selected);
                
                if (selectedAccount) {
                    // Verificar si el token necesita ser refrescado
                    if (await this.refreshTokenIfNeeded(selectedAccount)) {
                        // Si la cuenta es válida, ir directamente al home
                        await accountSelect(selectedAccount);
                        changePanel('home');
                        return true; // Indica que se encontró una cuenta válida
                    }
                }
            }
        } catch (error) {
            console.error('Error checking existing account:', error);
        }
        return false; // No se encontró cuenta válida
    }

    async refreshTokenIfNeeded(account) {
        try {
            // Solo refrescar tokens de Microsoft
            if (account.microsoft && account.refresh_token) {
                // Verificar si el token de acceso ha expirado o está próximo a expirar
                const now = Date.now();
                const tokenExpiry = account.expires_at || 0;
                
                // Si el token expira en menos de 5 minutos, refrescarlo
                if (tokenExpiry - now < 5 * 60 * 1000) {
                    console.log('Refrescando token de Microsoft...');
                    
                    let refreshedAccount = await ipcRenderer.invoke('Microsoft-refresh', account.refresh_token);
                    
                    if (refreshedAccount && !refreshedAccount.error) {
                        // Actualizar la cuenta con los nuevos tokens
                        Object.assign(account, refreshedAccount);
                        await this.db.updateData('accounts', account);
                        console.log('Token refrescado exitosamente');
                        return true;
                    } else {
                        console.log('Error al refrescar token, se requiere nuevo login');
                        return false;
                    }
                }
            }
            
            // Para cuentas offline o tokens válidos
            return true;
            
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    }

    async getMicrosoft() {
        console.log('Iniciando cuenta de Microsoft.');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        let crackBtn = document.querySelector('.connect-crack');
        let cancelBtnHome = document.querySelector('.cancel-home');
    
        // Mostrar la pantalla principal
        loginHome.style.display = 'block';
        cancelBtnHome.style.display = 'none'; // Asegúrate de que esté oculto inicialmente
    
        // Evento para la cuenta Offline
        crackBtn.addEventListener("click", () => {
            this.getCrack(); // Llamar a la función getCrack
        });
    
        // Evento para la cuenta de Microsoft
        microsoftBtn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Conectando',
                content: 'Espere por favor ⏳',
                color: 'var(--color)'
            });
    
            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                if (account_connect === 'cancel' || !account_connect) {
                    popupLogin.closePopup();
                    return;
                } else {
                    await this.saveData(account_connect);
                    popupLogin.closePopup();
                }
            }).catch(err => {
                popupLogin.openPopup({
                    title: 'Error',
                    content: err,
                    options: true
                });
            });
        });
    }
    
    async getCrack() {
        console.log('Iniciando cuenta Offline.');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let loginOffline = document.querySelector('.login-offline');
        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-offline');
        let cancelBtnOffline = document.querySelector('.cancel-offline');
    
        // Mostrar vista de cuenta Offline
        loginHome.style.display = 'none'; // Ocultar la pantalla principal
        loginOffline.style.display = 'block'; // Mostrar la vista de Offline
        cancelBtnOffline.style.display = 'block'; // Asegurarse de que el botón de cancelar esté visible
    
        // Evento de Cancelar para regresar a loginHome desde Offline
        cancelBtnOffline.addEventListener("click", () => {
            loginOffline.style.display = 'none'; // Ocultar la vista de Offline
            loginHome.style.display = 'block'; // Mostrar la pantalla principal
            cancelBtnOffline.style.display = 'none'; // Ocultar el botón de cancelar
        });
    
        // Evento de Conectar en modo Offline
        connectOffline.addEventListener('click', async () => {
            if (emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu apodo debe tener al menos 3 caracteres.',
                    options: true
                });
                return;
            }
    
            if (emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu apodo no debe contener espacios.',
                    options: true
                });
                return;
            }
    
            let MojangConnect = await Mojang.login(emailOffline.value);
    
            if (MojangConnect.error) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: MojangConnect.message,
                    options: true
                });
                return;
            }
    
            await this.saveData(MojangConnect);
            popupLogin.closePopup();
            loginOffline.style.display = 'none'; // Oculta la vista de Offline después de iniciar sesión
            loginHome.style.display = 'block'; // Muestra la pantalla principal
            cancelBtnOffline.style.display = 'none'; // Oculta el botón de cancelar
        });
    }  
    
    async getAZauth() {
        console.log('Iniciando cuenta de AZauth.');
        let AZauthClient = new AZauth(this.config.online);
        let PopupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');

        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');
        let AZauthConnectBTN = document.querySelector('.connect-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');

        loginAZauth.style.display = 'block';

        AZauthConnectBTN.addEventListener('click', async () => {
            PopupLogin.openPopup({
                title: 'Conexión en curso.',
                content: 'Espere por favor.',
                color: 'var(--color)'
            });

            if (AZauthEmail.value == '' || AZauthPassword.value == '') {
                PopupLogin.openPopup({
                    title: 'Error',
                    content: 'Por favor complete todos los campos.',
                    options: true
                });
                return;
            }

            let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

            if (AZauthConnect.error) {
                PopupLogin.openPopup({
                    title: 'Error',
                    content: AZauthConnect.message,
                    options: true
                });
                return;
            } else if (AZauthConnect.A2F) {
                loginAZauthA2F.style.display = 'block';
                loginAZauth.style.display = 'none';
                PopupLogin.closePopup();

                AZauthCancelA2F.addEventListener('click', () => {
                    loginAZauthA2F.style.display = 'none';
                    loginAZauth.style.display = 'block';
                });

                connectAZauthA2F.addEventListener('click', async () => {
                    PopupLogin.openPopup({
                        title: 'Conexión en curso.',
                        content: 'Espere por favor.',
                        color: 'var(--color)'
                    });

                    if (AZauthA2F.value == '') {
                        PopupLogin.openPopup({
                            title: 'Error',
                            content: 'Por favor ingrese el código A2F.',
                            options: true
                        });
                        return;
                    }

                    AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if (AZauthConnect.error) {
                        PopupLogin.openPopup({
                            title: 'Error',
                            content: AZauthConnect.message,
                            options: true
                        });
                        return;
                    }

                    await this.saveData(AZauthConnect)
                    PopupLogin.closePopup();
                });
            } else if (!AZauthConnect.A2F) {
                await this.saveData(AZauthConnect)
                PopupLogin.closePopup();
            }
        });
    }

    async saveData(connectionData) {
        let configClient = await this.db.readData('configClient');
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_selct
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == account.name)
                if (whitelist !== account.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_selct = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        changePanel('home');
    }
}
export default Login;