import assert from 'node:assert/strict';
import { normalizeCompanyData, normalizeBrandColor, validateCompanyContacts } from './company-data';
const legacy = normalizeCompanyData({ name: ' Legacy ' });
assert.equal(legacy.name, 'Legacy'); assert.equal(legacy.website, ''); assert.equal(legacy.brandColor, '');
const full = normalizeCompanyData({ website: ' https://example.com ', email: ' hi@example.com ', phone: ' +20 ', address: ' Cairo ', socialUrl: ' https://linkedin.com/x ', brandColor: '#abc123' });
assert.equal(full.website, 'https://example.com'); assert.equal(full.brandColor, '#ABC123'); assert.deepEqual(validateCompanyContacts(full), {});
assert.equal(normalizeBrandColor('#fff'), ''); assert.ok(validateCompanyContacts({ website: 'example.com', email: '', phone: '', socialUrl: '' }).website);
console.log('company-data tests passed');
