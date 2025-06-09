/**
 * @author Pablo
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const { AZauth, Mojang, Microsoft } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";
    
    async init(config) {
        this.config = config;
        this.db = new database();

        // Primero verificar si hay una cuenta existente y válida
        await this.checkExistingAccount();
    }

    async checkExistingAccount() {
        try {
            let configClient = await this.db.readData('configClient');
            
            if (configClient && configClient.account_selected) {
                let account = await this.db.readData('accounts', configClient.account_selected);
                
                if (account) {
                    console.log('Cuenta existente encontrada, verificando token...');
                    
                    // Verificar y refrescar token según el tipo de cuenta
                    let refreshedAccount = await this.refreshAccountToken(account);
                    
                    if (refreshedAccount) {
                        console.log('Token refrescado exitosamente, auto-login...');
                        await this.db.updateData('accounts', refreshedAccount, account.ID);
                        await accountSelect(refreshedAccount);
                        changePanel('home');
                        return; // Auto-login exitoso
                    } else {
                        console.log('No se pudo refrescar el token, mostrando login...');
                    }
                }
            }
            
            // Si no hay cuenta válida, mostrar login
            this.showLoginInterface();
            
        } catch (error) {
            console.error('Error verificando cuenta existente:', error);
            this.showLoginInterface();
        }
    }

    async refreshAccountToken(account) {
        try {
            // Verificar si el token ha expirado (si existe expires_at)
            if (account.expires_at && Date.now() < account.expires_at) {
                console.log('Token aún válido');
                return account; // Token aún válido
            }

            if (account.refresh_token) {
                // Cuenta Microsoft/Xbox - usar refresh token
                if (account.meta && account.meta.type === 'msa') {
                    return await this.refreshMicrosoftToken(account);
                }
                // Cuenta AZauth - usar refresh token si está disponible
                else if (this.config.online && typeof this.config.online === 'string') {
                    return await this.refreshAZauthToken(account);
                }
            }
            
            // Para cuentas offline (Mojang crack), no hay refresh necesario
            if (account.meta && account.meta.type === 'offline') {
                return account;
            }

            return null; // No se pudo refrescar
            
        } catch (error) {
            console.error('Error refrescando token:', error);
            return null;
        }
    }

    async refreshMicrosoftToken(account) {
        try {
            if (!account.refresh_token) return null;
            
            const refreshedAuth = await ipcRenderer.invoke('Microsoft-refresh', this.config.client_id, account.refresh_token);
            
            if (refreshedAuth && !refreshedAuth.error) {
                // Actualizar el account con los nuevos tokens
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
            console.error('Error refrescando token Microsoft:', error);
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

    async getCrack() {
        console.log('Initializing offline login...');
        let popupLogin = new popup();
        let loginOffline = document.querySelector('.login-offline');

        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-offline');
        loginOffline.style.display = 'block';

        connectOffline.addEventListener('click', async () => {
            if (emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo doit faire au moins 3 caractères.',
                    options: true
                });
                return;
            }

            if (emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo ne doit pas contenir d\'espaces.',
                    options: true
                });
                return;
            }

            let MojangConnect = await Mojang.login(emailOffline.value);

            if (MojangConnect.error) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: MojangConnect.message,
                    options: true
                });
                return;
            }
            
            // Las cuentas offline no expiran
            MojangConnect.expires_at = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 año
            await this.saveData(MojangConnect)
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