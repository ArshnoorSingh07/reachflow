import "../config/env.js";
import { initializeSearch } from "../services/search-schema.service.js";
await initializeSearch();
console.log("Elasticsearch email index ready");
