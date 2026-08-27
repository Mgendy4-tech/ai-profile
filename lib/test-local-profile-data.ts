import assert from "node:assert/strict";
import { APPLICATION_STORAGE_KEYS, clearApplicationLocalData } from "./local-profile-data";
const values = new Map<string,string>([["unrelated-app", "keep"], ...APPLICATION_STORAGE_KEYS.map((key) => [key, `value:${key}`] as [string,string])]);
const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); } };
const result = clearApplicationLocalData(storage as Pick<Storage,"getItem"|"removeItem">);
assert(result.complete); assert.equal(result.removedKeys.length, APPLICATION_STORAGE_KEYS.length); assert.equal(values.get("unrelated-app"), "keep"); assert(APPLICATION_STORAGE_KEYS.every((key) => !values.has(key)));
const again = clearApplicationLocalData(storage as Pick<Storage,"getItem"|"removeItem">); assert(again.complete && again.removedKeys.length === 0);
console.log("Application-owned local data cleanup and unrelated-origin isolation tests passed.");
