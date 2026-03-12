/**
 * Utility to map object keys from snake_case to camelCase
 */

const toCamel = (s) => {
    return s.replace(/([-_][a-z])/ig, ($1) => {
        return $1.toUpperCase()
            .replace('-', '')
            .replace('_', '');
    });
};

const isObject = (obj) => {
    return obj === Object(obj) && !Array.isArray(obj) && typeof obj !== 'function';
};

const snakeToCamel = (data) => {
    if (Array.isArray(data)) {
        return data.map(v => snakeToCamel(v));
    } else if (isObject(data)) {
        // Fix: Do not recurse into Date objects
        if (data instanceof Date) return data;

        const n = {};
        Object.keys(data).forEach((k) => {
            n[toCamel(k)] = snakeToCamel(data[k]);
        });
        return n;
    }
    return data;
};

module.exports = { snakeToCamel };
