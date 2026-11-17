(() => {
    const CLIENT_ID = '0928fbae22444ecb980b974ec4e06165';
    const SCOPES = [
        'user-read-currently-playing',
        'streaming',
        'user-modify-playback-state',
        'user-read-email',
        'user-read-private'
    ];
    const TOKEN_URL = 'https://accounts.spotify.com/api/token';
    const PLAYER_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
    const TRANSFER_URL = 'https://api.spotify.com/v1/me/player';
    const TOKEN_KEY = 'opoku.spotify.tokens';
    const AUTH_KEY = 'opoku.spotify.authorization';
    const POLL_INTERVAL_MS = 20000;
    const elements = {
        artwork: document.getElementById('spotifyArtwork'),
        connect: document.getElementById('spotifyConnect'),
        details: document.getElementById('spotifyDetails'),
        disconnect: document.getElementById('spotifyDisconnect'),
        open: document.getElementById('spotifyOpen'),
        playHere: document.getElementById('spotifyPlayHere'),
        state: document.getElementById('spotifyState'),
        title: document.getElementById('spotifyTitle')
    };

    let tokens;
    let player = null;
    let playerDeviceId = '';
    let playerReady = false;
    let playerStarting = false;
    let playerFailed = false;
    let reauthorizationRequired = false;
    let sdkPromise = null;
    let tokenRefresh = null;
    let polling = false;
    let retryAfter = 0;
    tokens = readTokens();

    function parseStoredValue(key) {
        const value = sessionStorage.getItem(key);
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn(`Removing invalid Spotify session data (${key}).`, error);
            sessionStorage.removeItem(key);
            return null;
        }
    }

    function readTokens() {
        const stored = parseStoredValue(TOKEN_KEY);
        if (!stored || typeof stored.accessToken !== 'string') return null;
        return stored;
    }

    function saveTokens(response, previous = null) {
        if (typeof response.access_token !== 'string' || !Number.isFinite(response.expires_in)) {
            throw new Error('Spotify returned an incomplete token response.');
        }
        tokens = {
            accessToken: response.access_token,
            refreshToken: response.refresh_token || previous?.refreshToken || '',
            expiresAt: Date.now() + response.expires_in * 1000,
            scope: response.scope || previous?.scope || ''
        };
        reauthorizationRequired = false;
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
        updateConnectionButtons();
        return tokens;
    }

    function clearTokens() {
        tokens = null;
        reauthorizationRequired = false;
        sessionStorage.removeItem(TOKEN_KEY);
        disconnectPlaybackDevice();
        updateConnectionButtons();
    }

    function hasPlaybackScopes() {
        const scopes = new Set((tokens?.scope || '').split(/\s+/).filter(Boolean));
        return SCOPES.every(scope => scopes.has(scope));
    }

    function updateConnectionButtons() {
        const connected = Boolean(tokens?.accessToken);
        const needsPlaybackAccess = connected && !hasPlaybackScopes();
        const needsReauthorization = connected && reauthorizationRequired;
        const canRetryPlayer = connected && hasPlaybackScopes() && playerFailed && !needsReauthorization;
        elements.connect.hidden = connected && !needsPlaybackAccess && !needsReauthorization && !canRetryPlayer;
        elements.connect.textContent = !connected ? 'Connect Spotify' :
            needsReauthorization ? 'Reconnect Spotify' : needsPlaybackAccess ? 'Enable audio' : 'Retry audio';
        elements.disconnect.hidden = !connected;
        elements.playHere.hidden = !(connected && hasPlaybackScopes() && playerReady);
        elements.playHere.disabled = !playerReady;
    }

    function disconnectPlaybackDevice() {
        const activePlayer = player;
        player = null;
        playerDeviceId = '';
        playerReady = false;
        playerStarting = false;
        playerFailed = false;
        if (activePlayer) {
            try {
                Promise.resolve(activePlayer.disconnect()).catch(error => {
                    console.warn('Spotify playback device did not disconnect cleanly.', error);
                });
            } catch (error) {
                console.warn('Spotify playback device did not disconnect cleanly.', error);
            }
        }
    }

    function clearTrackArtwork() {
        elements.artwork.hidden = true;
        elements.artwork.removeAttribute('src');
        elements.artwork.alt = '';
    }

    function setDisconnected(message = 'See what is playing on your phone.') {
        elements.state.textContent = 'SPOTIFY · NOT CONNECTED';
        elements.title.textContent = 'Connect Spotify';
        elements.details.textContent = message;
        elements.open.hidden = true;
        elements.open.href = '#';
        clearTrackArtwork();
        updateConnectionButtons();
    }

    function setConnected(message = 'Checking your Spotify playback.') {
        elements.state.textContent = hasPlaybackScopes() ? 'SPOTIFY · CONNECTED' : 'SPOTIFY · ENABLE AUDIO';
        elements.title.textContent = 'Connected to Spotify';
        elements.details.textContent = message;
        updateConnectionButtons();
    }

    function isSecurePlaybackOrigin() {
        return location.protocol === 'https:' ||
            (location.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
    }

    function showError(message) {
        elements.state.textContent = 'SPOTIFY · CONNECTION ISSUE';
        elements.details.textContent = message;
    }

    function spotifyUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && url.hostname === 'open.spotify.com' ? url.href : '';
        } catch {
            return '';
        }
    }

    function secureAssetUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? url.href : '';
        } catch {
            return '';
        }
    }

    function renderPlayback(data) {
        const item = data.item;
        if (!item) {
            elements.state.textContent = 'SPOTIFY · CONNECTED';
            elements.title.textContent = data.currently_playing_type === 'ad' ? 'Spotify is playing an ad' : 'Nothing is playing';
            elements.details.textContent = 'Start playback from Spotify on your phone or another device.';
            elements.open.hidden = true;
            elements.open.href = '#';
            clearTrackArtwork();
            return;
        }

        const artists = item.artists?.map(artist => artist.name).filter(Boolean).join(', ');
        const details = artists || item.show?.name || 'Spotify';
        const artwork = item.album?.images?.find(image => image.url)?.url || item.images?.find(image => image.url)?.url;
        const artworkUrl = secureAssetUrl(artwork);
        const trackUrl = spotifyUrl(item.external_urls?.spotify);

        elements.state.textContent = `SPOTIFY · ${data.is_playing ? 'PLAYING' : 'PAUSED'}`;
        elements.title.textContent = item.name || 'Unknown title';
        elements.details.textContent = details;
        elements.open.hidden = !trackUrl;
        elements.open.href = trackUrl || '#';
        elements.artwork.hidden = !artworkUrl;
        elements.artwork.alt = artworkUrl ? `Cover art for ${item.name || 'the current item'}` : '';
        if (artworkUrl) elements.artwork.src = artworkUrl;
        else elements.artwork.removeAttribute('src');
    }

    function redirectUri() {
        const url = new URL(location.href);
        if (url.protocol === 'http:' && url.hostname === 'localhost') url.hostname = '127.0.0.1';
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) {
            throw new Error('Open Opoku over HTTPS or at http://127.0.0.1 to connect Spotify.');
        }
        url.search = '';
        url.hash = '';
        return `${url.origin}${url.pathname}`;
    }

    function base64Url(bytes) {
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function randomString(byteLength) {
        return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
    }

    async function codeChallenge(verifier) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        return base64Url(new Uint8Array(digest));
    }

    async function beginAuthorization() {
        const uri = redirectUri();
        const verifier = randomString(64);
        const state = randomString(24);
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({ verifier, state, redirectUri: uri }));

        const url = new URL('https://accounts.spotify.com/authorize');
        url.search = new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            redirect_uri: uri,
            scope: SCOPES.join(' '),
            show_dialog: 'true',
            state,
            code_challenge_method: 'S256',
            code_challenge: await codeChallenge(verifier)
        });
        location.assign(url.href);
    }

    function clearAuthorizationQuery() {
        const url = new URL(location.href);
        for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function exchangeToken(parameters) {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(parameters)
        });
        const result = await response.json();
        if (!response.ok) {
            const detail = result.error_description || result.error?.message || result.error;
            const error = new Error(detail || `Spotify token request failed (${response.status}).`);
            error.code = result.error;
            throw error;
        }
        return result;
    }

    async function completeAuthorization() {
        const url = new URL(location.href);
        const code = url.searchParams.get('code');
        const authError = url.searchParams.get('error');
        if (!code && !authError) return;

        const returnedState = url.searchParams.get('state');
        const errorDescription = url.searchParams.get('error_description');
        const pending = parseStoredValue(AUTH_KEY);
        clearAuthorizationQuery();
        sessionStorage.removeItem(AUTH_KEY);

        if (!pending || typeof pending.verifier !== 'string' || returnedState !== pending.state) {
            throw new Error('Spotify sign-in could not be verified. Please connect again.');
        }
        if (authError) throw new Error(errorDescription || 'Spotify authorization was canceled.');

        const response = await exchangeToken({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            redirect_uri: pending.redirectUri,
            code_verifier: pending.verifier
        });
        saveTokens(response);
    }

    async function refreshTokens() {
        if (tokenRefresh) return tokenRefresh;
        if (!tokens?.refreshToken) {
            clearTokens();
            throw new Error('Your Spotify session expired. Connect again.');
        }

        const previous = tokens;
        tokenRefresh = exchangeToken({
            grant_type: 'refresh_token',
            refresh_token: previous.refreshToken,
            client_id: CLIENT_ID
        })
            .then(response => saveTokens(response, previous))
            .catch(error => {
            if (error instanceof Error && error.code === 'invalid_grant') clearTokens();
            throw error;
            })
            .finally(() => {
                tokenRefresh = null;
            });
        return tokenRefresh;
    }

    async function accessToken() {
        if (!tokens) throw new Error('Connect Spotify to see what is playing.');
        if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
        await refreshTokens();
        return tokens.accessToken;
    }

    async function spotifyRequest(url, options = {}) {
        const request = token => fetch(url, {
            ...options,
            headers: { ...options.headers, Authorization: `Bearer ${token}` },
            cache: 'no-store'
        });
        let response = await request(await accessToken());
        if (response.status === 401) {
            await refreshTokens();
            response = await request(tokens.accessToken);
        }
        return response;
    }

    async function refreshPlayback() {
        if (!tokens || polling || document.hidden || Date.now() < retryAfter) return;
        polling = true;
        try {
            const response = await spotifyRequest(PLAYER_URL);
            if (response.status === 401) {
                clearTokens();
                throw new Error('Spotify sign-in expired. Connect again.');
            }
            if (response.status === 204) {
                renderPlayback({});
                return;
            }
            if (response.status === 429) {
                const seconds = Number(response.headers.get('Retry-After')) || 30;
                retryAfter = Date.now() + Math.max(seconds, 5) * 1000;
                throw new Error('Spotify is rate-limiting updates. Opoku will try again shortly.');
            }
            if (response.status === 403) {
                throw new Error('Spotify denied access. Check the account and app permissions, then reconnect.');
            }
            if (!response.ok) throw new Error(`Spotify playback request failed (${response.status}).`);
            renderPlayback(await response.json());
        } catch (error) {
            if (!tokens) setDisconnected(error instanceof Error ? error.message : 'Reconnect Spotify to continue.');
            else showError(error instanceof Error ? error.message : 'Spotify could not be reached.');
            console.error('Spotify Now Playing update failed.', error);
        } finally {
            polling = false;
        }
    }

    function loadPlaybackSdk() {
        if (window.Spotify?.Player) return Promise.resolve();
        if (sdkPromise) return sdkPromise;

        sdkPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timeout = setTimeout(() => reject(new Error('Spotify playback SDK did not become ready.')), 15000);
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            window.onSpotifyWebPlaybackSDKReady = () => {
                clearTimeout(timeout);
                if (window.Spotify?.Player) resolve();
                else reject(new Error('Spotify playback SDK did not initialize.'));
            };
            script.onload = () => {
                if (!window.Spotify?.Player) return;
                clearTimeout(timeout);
                resolve();
            };
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Spotify playback SDK could not be loaded.'));
            };
            document.head.append(script);
        }).catch(error => {
            sdkPromise = null;
            throw error;
        });
        return sdkPromise;
    }

    function playbackDeviceError(message, reconnect = false) {
        disconnectPlaybackDevice();
        playerFailed = true;
        reauthorizationRequired = reconnect;
        showError(message);
        updateConnectionButtons();
        console.error('Spotify playback device failed.', message);
    }

    async function initializePlaybackDevice() {
        if (!tokens || !hasPlaybackScopes() || playerStarting || playerReady) return;
        if (!isSecurePlaybackOrigin()) {
            playbackDeviceError('Spotify browser playback needs HTTPS or a local HTTP server; file URLs are not supported.');
            return;
        }
        if (player) disconnectPlaybackDevice();
        playerStarting = true;
        playerFailed = false;
        elements.state.textContent = 'SPOTIFY · STARTING PLAYER';
        elements.details.textContent = 'Connecting Opoku as a Spotify Connect device.';

        try {
            await loadPlaybackSdk();
            if (!tokens) throw new Error('Reconnect Spotify to enable browser playback.');

            const activePlayer = new window.Spotify.Player({
                name: 'Opoku',
                getOAuthToken: callback => {
                    accessToken().then(callback).catch(error => {
                        showError(error instanceof Error ? error.message : 'Spotify authorization expired.');
                        console.error('Spotify could not provide a player token.', error);
                    });
                },
                volume: 0.6
            });
            player = activePlayer;
            activePlayer.addListener('ready', ({ device_id }) => {
                if (player !== activePlayer) return;
                playerDeviceId = device_id;
                playerReady = true;
                playerStarting = false;
                playerFailed = false;
                elements.state.textContent = 'SPOTIFY · READY IN CONNECT';
                elements.details.textContent = 'Choose Opoku on your phone, or select Play here.';
                updateConnectionButtons();
                void refreshPlayback();
            });
            activePlayer.addListener('not_ready', ({ device_id }) => {
                if (player !== activePlayer || device_id !== playerDeviceId) return;
                playbackDeviceError('Opoku went offline. Retry audio to register the playback device again.');
            });
            activePlayer.addListener('initialization_error', ({ message }) => {
                playbackDeviceError(`Spotify player could not initialize: ${message}`);
            });
            activePlayer.addListener('authentication_error', ({ message }) => {
                playbackDeviceError(`Spotify rejected the player token: ${message}. Reconnect and approve the playback permissions.`, true);
            });
            activePlayer.addListener('account_error', ({ message }) => {
                playbackDeviceError(`Spotify Premium is required for Opoku playback. ${message}`);
            });
            activePlayer.addListener('playback_error', ({ message }) => {
                showError(`Spotify could not play audio in this browser: ${message}`);
            });
            activePlayer.addListener('player_state_changed', state => {
                if (state) void refreshPlayback();
            });

            if (!await activePlayer.connect()) throw new Error('Spotify could not register Opoku as a playback device.');
            playerStarting = false;
        } catch (error) {
            playbackDeviceError(error instanceof Error ? error.message : 'Spotify playback could not be started.');
        }
    }

    async function transferPlayback(activation) {
        if (!playerReady || !playerDeviceId) throw new Error('Wait for Opoku to appear as a Spotify playback device.');
        await activation;
        const response = await spotifyRequest(TRANSFER_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [playerDeviceId], play: true })
        });
        if (response.status === 401) {
            clearTokens();
            throw new Error('Spotify sign-in expired. Connect again.');
        }
        if (response.status === 403) throw new Error('Spotify could not transfer playback. Check your Premium account and app permissions.');
        if (response.status === 404) throw new Error('Spotify could not find the playback device. Reconnect Opoku and try again.');
        if (response.status === 429) throw new Error('Spotify is rate-limiting playback requests. Try again shortly.');
        if (!response.ok) throw new Error(`Spotify could not transfer playback (${response.status}).`);

        elements.state.textContent = 'SPOTIFY · PLAYING ON OPOKU';
        elements.details.textContent = 'Audio is playing in this browser.';
        setTimeout(() => void refreshPlayback(), 1500);
    }

    elements.connect.addEventListener('click', () => {
        if (tokens && hasPlaybackScopes() && playerFailed && !reauthorizationRequired) {
            void initializePlaybackDevice();
            return;
        }
        elements.state.textContent = 'SPOTIFY · OPENING';
        elements.details.textContent = 'Continue in Spotify to allow Opoku to show and play Spotify audio.';
        beginAuthorization().catch(error => {
            showError(error instanceof Error ? error.message : 'Spotify sign-in could not be started.');
            console.error('Spotify authorization could not be started.', error);
        });
    });

    elements.playHere.addEventListener('click', () => {
        let activation;
        try {
            activation = player?.activateElement?.();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'The browser could not activate Spotify audio.');
            console.error('Spotify audio activation failed.', error);
            return;
        }
        transferPlayback(activation).catch(error => {
            showError(error instanceof Error ? error.message : 'Spotify playback could not be transferred.');
            console.error('Spotify playback transfer failed.', error);
        });
    });

    elements.disconnect.addEventListener('click', () => {
        clearTokens();
        sessionStorage.removeItem(AUTH_KEY);
        setDisconnected('Disconnected from Opoku. Connect again whenever you like.');
    });

    elements.artwork.addEventListener('error', clearTrackArtwork);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void refreshPlayback();
    });
    setInterval(() => void refreshPlayback(), POLL_INTERVAL_MS);

    async function initialize() {
        try {
            await completeAuthorization();
            tokens = readTokens();
            if (!tokens) {
                setDisconnected();
                return;
            }
            setConnected();
            await refreshPlayback();
            if (!tokens) return;
            if (hasPlaybackScopes()) await initializePlaybackDevice();
            else {
                elements.state.textContent = 'SPOTIFY · ENABLE AUDIO';
                elements.details.textContent = 'Reconnect Spotify to enable playback on Opoku.';
            }
        } catch (error) {
            if (tokens) showError(error instanceof Error ? error.message : 'Spotify could not be reached.');
            else setDisconnected(error instanceof Error ? error.message : 'Spotify sign-in could not be completed.');
            console.error('Spotify initialization failed.', error);
        }
    }

    void initialize();
})();
