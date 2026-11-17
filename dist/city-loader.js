(() => {
    const cities = [
        { id: 'athens', name: 'Athens', timeZone: 'Europe/Athens', config: 'city-config-athens.js' },
        { id: 'thessaloniki', name: 'Thessaloniki', timeZone: 'Europe/Athens', config: 'city-config-thessaloniki.js' },
        { id: 'berlin', name: 'Berlin', timeZone: 'Europe/Berlin', config: 'city-config-berlin.js' },
        { id: 'london', name: 'London', timeZone: 'Europe/London', config: 'city-config-london.js' },
        { id: 'barcelona', name: 'Barcelona', timeZone: 'Europe/Madrid', config: 'city-config-barcelona.js' },
        { id: 'paris', name: 'Paris', timeZone: 'Europe/Paris', config: 'city-config-paris.js' },
        { id: 'new-york', name: 'New York', timeZone: 'America/New_York', config: 'city-config-new-york.js' },
        { id: 'rio-de-janeiro', name: 'Rio de Janeiro', timeZone: 'America/Sao_Paulo', config: 'city-config-rio-de-janeiro.js' },
        { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo', config: 'city-config-tokyo.js' },
        { id: 'hong-kong', name: 'Hong Kong', timeZone: 'Asia/Hong_Kong', config: 'city-config-hong-kong.js' },
        { id: 'singapore', name: 'Singapore', timeZone: 'Asia/Singapore', config: 'city-config-singapore.js' },
        { id: 'san-francisco', name: 'San Francisco', timeZone: 'America/Los_Angeles', config: 'city-config-san-francisco.js' }
    ];
    const defaultCity = cities[0];
    const requestedId = new URLSearchParams(location.search).get('city')?.toLowerCase();
    const requestedCity = cities.find(city => city.id === requestedId) || defaultCity;

    window.OPOKU_CITIES = cities;

    function setCityUrl(city) {
        const url = new URL(location.href);
        if (city.id === defaultCity.id) url.searchParams.delete('city');
        else url.searchParams.set('city', city.id);
        history.replaceState(null, '', url);
    }

    function showError(message) {
        console.error(message);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
            document.body.classList.remove('ui-hidden');
        }
    }

    function startApp(city) {
        const configCity = window.OPOKU_CONFIG?.city;
        if (!configCity) {
            showError('Unable to load the city configuration. Please reload the page.');
            return;
        }
        if (!configCity.timeZone) {
            if (!city.timeZone) {
                showError(`Missing time zone for ${configCity.name}. Please update its city configuration.`);
                return;
            }
            console.warn(`City configuration for ${configCity.name} has no time zone; using ${city.timeZone}.`);
            configCity.timeZone = city.timeZone;
        }

        window.OPOKU_CITY_SLUG = city.id;
        document.title = `Opoku x ${configCity.name}`;
        if (city.id !== requestedCity.id) setCityUrl(city);

        const app = document.createElement('script');
        app.src = 'app.js';
        app.onerror = () => showError('Unable to load the application. Please reload the page.');
        document.body.append(app);
    }

    if (requestedCity.id === defaultCity.id) {
        startApp(defaultCity);
        return;
    }

    const config = document.createElement('script');
    config.src = requestedCity.config;
    config.onload = () => startApp(requestedCity);
    config.onerror = () => {
        console.error(`Could not load ${requestedCity.name} configuration; using Athens.`);
        startApp(defaultCity);
    };
    document.head.append(config);
})();
