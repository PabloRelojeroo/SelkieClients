/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const { AZauth, Mojang, Microsoft } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';
const isDev = process.env.NODE_ENV === 'dev';

// Función helper para logging
function debugLog(message, data = null) {
    if (isDev) {
        console.log(`[DEBUG] ${message}`, data || '');
    } else {
        console.log(`[PROD] ${message}`, data || '');
    }
}

class Login {
    static id = "login";
    
    async init(config) {
        this.config = config;
        this.db = new database();
        
        debugLog('Iniciando Login panel', {
            online: this.config.online,
            client_id: this.config.client_id,
            isDev: isDev
        });
    
        // Primero verificar si hay una cuenta existente y válida
        const hasExistingAccount = await this.checkExistingAccount();
        debugLog('Resultado checkExistingAccount:', hasExistingAccount);
    }

    async checkExistingAccount() {
        try {
            let configClient = await this.db.readData('configClient');
            
            if (configClient && configClient.account_selected) {
                let account = await this.db.readData('accounts', configClient.account_selected);
                
                if (account) {
                    console.log('Cuenta existente encontrada:', account.name);
                    
                    // Verificar y refrescar token según el tipo de cuenta
                    let refreshedAccount = await this.refreshAccountToken(account);
                    
                    if (refreshedAccount) {
                        console.log('Token válido o refrescado exitosamente, auto-login...');
                        // Solo actualizar si realmente se refrescó
                        if (refreshedAccount !== account) {
                            await this.db.updateData('accounts', refreshedAccount, account.ID);
                        }
                        await accountSelect(refreshedAccount);
                        changePanel('home');
                        return true; // Auto-login exitoso
                    } else {
                        console.log('Token expirado y no se pudo refrescar, eliminando cuenta...');
                        // Remover cuenta con token inválido
                        await this.db.deleteData('accounts', account.ID);
                        configClient.account_selected = null;
                        await this.db.updateData('configClient', configClient);
                    }
                }
            }
            
            // Si no hay cuenta válida, mostrar login
            this.showLoginInterface();
            return false;
            
        } catch (error) {
            console.error('Error verificando cuenta existente:', error);
            this.showLoginInterface();
            return false;
        }
    }

    async refreshAccountToken(account) {
        try {
            // Para cuentas offline, siempre son válidas
            if (account.meta && account.meta.type === 'offline') {
                console.log('Cuenta offline - siempre válida');
                return account;
            }
    
            // Verificar si el token ha expirado
            const now = Date.now();
            const tokenExpired = account.expires_at && now >= account.expires_at;
            
            if (!tokenExpired && account.access_token) {
                console.log('Token aún válido, no necesita refresh');
                return account; // Token aún válido
            }
    
            console.log('Token expirado, intentando refresh...');
    
            // Intentar refresh según el tipo de cuenta
            if (account.refresh_token) {
                // Cuenta Microsoft/Xbox
                if (account.meta && account.meta.type === 'msa') {
                    return await this.refreshMicrosoftToken(account);
                }
                // Cuenta AZauth
                else if (this.config.online && typeof this.config.online === 'string') {
                    return await this.refreshAZauthToken(account);
                }
            }
            
            console.log('No se puede refrescar - no hay refresh_token o tipo no soportado');
            return null; // No se pudo refrescar
            
        } catch (error) {
            console.error('Error refrescando token:', error);
            return null;
        }
    }

    async refreshMicrosoftToken(account) {
        try {
            if (!account.refresh_token) {
                debugLog('No hay refresh_token disponible para:', account.name);
                return null;
            }
            
            debugLog('Refrescando token Microsoft para:', {
                name: account.name,
                expires_at: new Date(account.expires_at).toISOString(),
                client_id: this.config.client_id
            });
            
            const refreshedAuth = await ipcRenderer.invoke('Microsoft-refresh', this.config.client_id, account.refresh_token);
            
            debugLog('Respuesta refresh Microsoft:', {
                hasError: !!refreshedAuth?.error,
                hasAccessToken: !!refreshedAuth?.access_token,
                message: refreshedAuth?.message
            });
            
            if (refreshedAuth && !refreshedAuth.error && refreshedAuth.access_token) {
                debugLog('Token Microsoft refrescado exitosamente para:', account.name);
                return {
                    ...account,
                    access_token: refreshedAuth.access_token,
                    refresh_token: refreshedAuth.refresh_token || account.refresh_token,
                    expires_at: Date.now() + ((refreshedAuth.expires_in || 3600) * 1000),
                    uuid: refreshedAuth.uuid || account.uuid,
                    name: refreshedAuth.name || account.name,
                    profile: refreshedAuth.profile || account.profile
                };
            } else {
                debugLog('Error en refresh Microsoft:', refreshedAuth?.message || 'Respuesta inválida');
            }
            
            return null;
        } catch (error) {
            debugLog('Excepción refrescando token Microsoft:', error.message);
            return null;
        }
    }

    async refreshAZauthToken(account) {
        try {
            if (!account.refresh_token) return null;
            
            const azauth = new AZauth(this.config.online);
            const refreshedAuth = await azauth.refresh(account.refresh_token);
            
            if (refreshedAuth && !refreshedAuth.error) {
                return {
                    ...account,
                    access_token: refreshedAuth.access_token,
                    refresh_token: refreshedAuth.refresh_token,
                    expires_at: Date.now() + (refreshedAuth.expires_in * 1000),
                    uuid: refreshedAuth.uuid || account.uuid,
                    name: refreshedAuth.name || account.name
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error refrescando token AZauth:', error);
            return null;
        }
    }

    showLoginInterface() {
        console.log('Mostrando interfaz de login, config.online:', this.config.online);
        
        // Limpiar cualquier event listener previo
        this.removeExistingListeners();
        
        if (typeof this.config.online == 'boolean') {
            if (this.config.online) {
                this.getMicrosoft();
            } else {
                this.getCrack();
            }
        } else if (typeof this.config.online == 'string') {
            if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                this.getAZauth();
            } else {
                console.error('URL de AZauth inválida:', this.config.online);
                this.getCrack(); // Fallback a modo offline
            }
        } else {
            console.error('Configuración online inválida:', this.config.online);
            this.getCrack(); // Fallback a modo offline
        }
        
        // Event listener para el botón cancel
        const cancelBtn = document.querySelector('.cancel-home');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                cancelBtn.style.display = 'none';
                changePanel('settings');
            });
        }
    }
    

    async getMicrosoft() {
        console.log('Initializing Microsoft login...');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        loginHome.style.display = 'block';

        microsoftBtn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Connexion',
                content: 'Veuillez patienter...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                if (account_connect == 'cancel' || !account_connect) {
                    popupLogin.closePopup();
                    return;
                } else {
                    // Agregar información de expiración del token
                    if (account_connect.expires_in) {
                        account_connect.expires_at = Date.now() + (account_connect.expires_in * 1000);
                    }
                    await this.saveData(account_connect)
                    popupLogin.closePopup();
                }

            }).catch(err => {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: err,
                    options: true
                });
            });
        })
    }

    removeExistingListeners() {
        // Remover listeners de Microsoft
        const microsoftBtn = document.querySelector('.connect-home');
        if (microsoftBtn) {
            microsoftBtn.replaceWith(microsoftBtn.cloneNode(true));
        }
        
        // Remover listeners de Offline
        const connectOffline = document.querySelector('.connect-offline');
        if (connectOffline) {
            connectOffline.replaceWith(connectOffline.cloneNode(true));
        }
        
        // Remover listeners de AZauth
        const connectAZauth = document.querySelector('.connect-AZauth');
        if (connectAZauth) {
            connectAZauth.replaceWith(connectAZauth.cloneNode(true));
        }
    }

    async getCrack() {
        console.log('Initializing offline login...');
        let popupLogin = new popup();
        let loginOffline = document.querySelector('.login-offline');
    
        if (!loginOffline) {
            console.error('Elemento .login-offline no encontrado en el DOM');
            return;
        }
    
        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-offline');
        
        if (!emailOffline || !connectOffline) {
            console.error('Elementos de login offline no encontrados');
            return;
        }
        
        loginOffline.style.display = 'block';
        console.log('Panel offline mostrado');
    
        connectOffline.addEventListener('click', async () => {
            console.log('Botón offline clickeado');
            
            if (emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu nombre debe tener al menos 3 caracteres.',
                    options: true
                });
                return;
            }
    
            if (emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu nombre no debe contener espacios.',
                    options: true
                });
                return;
            }
    
            console.log('Intentando login offline con:', emailOffline.value);
    
            let MojangConnect = await Mojang.login(emailOffline.value);
    
            if (MojangConnect.error) {
                console.error('Error en login offline:', MojangConnect.message);
                popupLogin.openPopup({
                    title: 'Error',
                    content: MojangConnect.message,
                    options: true
                });
                return;
            }
            
            console.log('Login offline exitoso');
            // Las cuentas offline no expiran
            MojangConnect.expires_at = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 año
            await this.saveData(MojangConnect);
            popupLogin.closePopup();
        });
    }

    async getAZauth() {
        console.log('Initializing AZauth login...');
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
                title: 'Connexion en cours...',
                content: 'Veuillez patienter...',
                color: 'var(--color)'
            });

            if (AZauthEmail.value == '' || AZauthPassword.value == '') {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Veuillez remplir tous les champs.',
                    options: true
                });
                return;
            }

            let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

            if (AZauthConnect.error) {
                PopupLogin.openPopup({
                    title: 'Erreur',
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
                        title: 'Connexion en cours...',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    });

                    if (AZauthA2F.value == '') {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez entrer le code A2F.',
                            options: true
                        });
                        return;
                    }

                    AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if (AZauthConnect.error) {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: AZauthConnect.message,
                            options: true
                        });
                        return;
                    }

                    // Agregar información de expiración del token
                    if (AZauthConnect.expires_in) {
                        AZauthConnect.expires_at = Date.now() + (AZauthConnect.expires_in * 1000);
                    }
                    await this.saveData(AZauthConnect)
                    PopupLogin.closePopup();
                });
            } else if (!AZauthConnect.A2F) {
                // Agregar información de expiración del token
                if (AZauthConnect.expires_in) {
                    AZauthConnect.expires_at = Date.now() + (AZauthConnect.expires_in * 1000);
                }
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