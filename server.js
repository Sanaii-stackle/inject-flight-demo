// server.js
// Backend for Encryptic NC Flights demo using FlightAware AeroAPI + 1 simulated Bluff City flight

import http from "http";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

// ----- ES module __dirname setup -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Load environment variables -----
dotenv.config();
const PORT = process.env.PORT || 3000;
const AERO_BASE = process.env.COLLINS_BASE_URL;      // e.g. https://aeroapi.flightaware.com/aeroapi
const API_KEY = process.env.COLLINS_API_KEY;         // your AeroAPI key
const indexPath = path.join(__dirname, "index.html");

// ----- Simulated Bluff City flight (clearly labeled) -----
function getSimulatedBluffCityFlight() {
  return {
    id: "SIM-BLUFF-001",
    airline: "Bluff City Air (SIMULATED)",
    flightNumber: "BC999",
    origin: "Bluff City Airport (NIH) — SIMULATED — NOT REAL",
    originCode: "NIH",
    destination: "Charlotte Douglas Intl (KCLT)",
    destinationCode: "KCLT",
    scheduled: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // +2 hours
    status: "SIMULATED",
    note: "SIMULATED ENTRY — FOR DEMO/TESTING ONLY. NOT REAL FLIGHT DATA."
  };
}

// ----- Get real NC flights from FlightAware (arrivals into KCLT) -----
async function getCollinsFlights() {
  try {
    if (!AERO_BASE || !API_KEY) {
      console.error("❌ Missing COLLINS_BASE_URL or COLLINS_API_KEY in .env");
      return [];
    }

    // KCLT = Charlotte Douglas Intl, NC
    const airport = "KCLT";
    const url = `${AERO_BASE}/airports/${airport}/flights`;

    console.log("🌐 Fetching real flights from:", url);

    const res = await fetch(url, {
      headers: {
        "x-apikey": API_KEY,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`AeroAPI error ${res.status}`);
    }

    const data = await res.json();

    // API returns { arrivals: [...], departures: [...] }
    const arrivals = Array.isArray(data.arrivals) ? data.arrivals : [];
    console.log("✅ Got", arrivals.length, "real arrivals from AeroAPI");

    // Map each arrival into the shape your frontend expects
    return arrivals.map((f, i) => ({
      id: f.ident || `REAL-${i}`,
      airline: f.operator || f.airline || "Unknown Airline",
      flightNumber: f.ident || f.ident_iata || "N/A",

      // These are arrivals INTO KCLT, so origin is where it came from
      origin:
        (f.origin && (f.origin.airport_name || f.origin.name)) ||
        "Unknown",
      originCode:
        (f.origin &&
          (f.origin.code_iata ||
           f.origin.code_icao ||
           f.origin.code)) ||
        "??",

      // Destination is KCLT (the airport we asked for)
      destination: "Charlotte Douglas Intl (KCLT)",
      destinationCode: "KCLT",

      // Use one of the scheduled/estimated arrival times
      scheduled:
        f.scheduled_in ||
        f.estimated_in ||
        f.scheduled_on ||
        "",

      status: f.status || "Scheduled",
      note: "" // real flights: no simulated note
    }));
  } catch (err) {
    console.error("❌ FlightAware fetch failed:", err.message);
    return [];
  }
}

// ----- HTTP server -----
const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Serve frontend (index.html)
  if (req.url === "/" || req.url.startsWith("/index.html")) {
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error loading index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  }

  // Serve flights API
  else if (req.url.startsWith("/api/flights")) {
    let flights = await getCollinsFlights();

    // Always append clearly labeled Bluff City simulated flight
    flights.push(getSimulatedBluffCityFlight());

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ flights }));
  }

  // Everything else -> 404
  else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

// ----- Start server -----
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
