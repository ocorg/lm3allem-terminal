import { readFileSync, writeFileSync } from "fs"

const path = "messages/ar.json"
const ar = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""))

ar.costumes.nav.clients = "العملاء"

writeFileSync(path, JSON.stringify(ar, null, 2), "utf8")
console.log("Fixed costumes.nav.clients")