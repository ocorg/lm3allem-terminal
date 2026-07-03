import { readFileSync, writeFileSync } from "fs"

const ar = JSON.parse(readFileSync("messages/ar.json", "utf8").replace(/^\uFEFF/, ""))
writeFileSync("messages/fr.json", JSON.stringify(ar, null, 2), "utf8")