import { readFileSync } from "node:fs";
import { pool } from "../src/db.js";

const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
await pool.query(schema);
await pool.end();
console.log("schema applied");
