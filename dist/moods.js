window.OPOKU_MOODS = [
    {
        id: 'golden-hour',
        name: 'Golden hour',
        css: {
            ink: '#293c4d',
            muted: '#7d827e',
            paper: '#fcfaf5',
            ochre: '#d6a447',
            panel: '#fcfaf5f5',
            'panel-border': '#e3e0d6',
            surface: '#fffdf9',
            'surface-border': '#deddd3',
            divider: '#e5e2d9',
            subtle: '#eae9df',
            'button-text': '#ffffff',
            'aura-rgb': '214,164,71',
            'aura-highlight': '#fff6cc',
            'aura-core': '#ffca64',
            'aura-core-end': '#f18c6b'
        },
        map: {
            background: '#faf9f3',
            water: '#dfe9e9',
            parks: '#e3e8dc',
            buildings: '#eae7dc',
            buildingOutline: '#7b8285',
            roads: '#526071',
            labels: '#7a817f',
            labelHalo: '#faf9f3',
            routeWash: '#d4ac60',
            routePaper: '#fcfaf5',
            route: '#c9993f'
        }
    },
    {
        id: 'blue-hour',
        name: 'Blue hour',
        css: {
            ink: '#263d50',
            muted: '#718694',
            paper: '#e9f0f3',
            ochre: '#659db4',
            panel: '#f5f9fbed',
            'panel-border': '#d4e0e5',
            surface: '#fbfdfe',
            'surface-border': '#cfdee4',
            divider: '#dce6e9',
            subtle: '#e0eaee',
            'button-text': '#ffffff',
            'aura-rgb': '101,157,180',
            'aura-highlight': '#e7fbff',
            'aura-core': '#85cee0',
            'aura-core-end': '#537ca5'
        },
        map: {
            background: '#e7eef1',
            water: '#c8dce2',
            parks: '#d7e5df',
            buildings: '#d9e2e8',
            buildingOutline: '#718997',
            roads: '#526b80',
            labels: '#607587',
            labelHalo: '#e7eef1',
            routeWash: '#83b4c6',
            routePaper: '#f2f7f8',
            route: '#4b8aa3'
        }
    },
    {
        id: 'after-dark',
        name: 'After dark',
        css: {
            ink: '#e3e9e9',
            muted: '#a2b1b8',
            paper: '#17262f',
            ochre: '#e4a85f',
            panel: '#1f303af2',
            'panel-border': '#354954',
            surface: '#273943',
            'surface-border': '#40545e',
            divider: '#354751',
            subtle: '#30434d',
            'button-text': '#17262f',
            'aura-rgb': '228,168,95',
            'aura-highlight': '#fff0cf',
            'aura-core': '#ffc16b',
            'aura-core-end': '#d87568'
        },
        map: {
            background: '#17262f',
            water: '#223c49',
            parks: '#294139',
            buildings: '#304047',
            buildingOutline: '#718087',
            roads: '#82949e',
            labels: '#bac6ca',
            labelHalo: '#17262f',
            routeWash: '#c27e49',
            routePaper: '#33404a',
            route: '#f0ad61'
        }
    }
];

window.OPOKU_MOOD_FOR_CITY_TIME = (city, now = new Date()) => {
    if (!city.timeZone) throw new Error(`Missing time zone for ${city.name}.`);

    const getLocalParts = date => {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: city.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date);
        return Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
    };

    const localNow = getLocalParts(now);
    const utcDate = Date.UTC(localNow.year, localNow.month - 1, localNow.day);
    const dayOfYear = Math.floor((utcDate - Date.UTC(localNow.year, 0, 0)) / 86400000);
    const daysInYear = (Date.UTC(localNow.year + 1, 0, 1) - Date.UTC(localNow.year, 0, 1)) / 86400000;
    const gamma = 2 * Math.PI / daysInYear * (dayOfYear - 1);
    const equationOfTime = 229.18 * (
        0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma)
    );
    const declination =
        0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma);
    const latitude = city.center[1] * Math.PI / 180;
    const cosHourAngle =
        Math.cos(90.833 * Math.PI / 180) / (Math.cos(latitude) * Math.cos(declination)) -
        Math.tan(latitude) * Math.tan(declination);

    if (cosHourAngle > 1) return 'after-dark';
    if (cosHourAngle < -1) return 'golden-hour';

    const hourAngleDegrees = Math.acos(cosHourAngle) * 180 / Math.PI;
    const solarNoonUtcMinutes = 720 - 4 * city.center[0] - equationOfTime;
    const localMinuteOfDay = parts => parts.hour * 60 + parts.minute;
    const toLocalMinute = utcMinutes => {
        const eventDate = new Date(utcDate + utcMinutes * 60000);
        return localMinuteOfDay(getLocalParts(eventDate));
    };
    const sunrise = toLocalMinute(solarNoonUtcMinutes - 4 * hourAngleDegrees);
    const sunset = toLocalMinute(solarNoonUtcMinutes + 4 * hourAngleDegrees);
    const current = localMinuteOfDay(localNow);
    const withinBlueHour = event => {
        const difference = Math.abs(current - event);
        return Math.min(difference, 1440 - difference) <= 60;
    };

    if (withinBlueHour(sunrise) || withinBlueHour(sunset)) return 'blue-hour';
    return current > sunrise + 60 && current < sunset - 60 ? 'golden-hour' : 'after-dark';
};
