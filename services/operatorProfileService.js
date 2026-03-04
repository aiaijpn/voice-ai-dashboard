"use strict";

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "operatorProfile.json");

function ensureFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ profile_text: "", updated_at: null }, null, 2),
      "utf8"
    );
  }
}

function getProfile() {
  ensureFile();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const init = { profile_text: "", updated_at: null };
    fs.writeFileSync(DATA_PATH, JSON.stringify(init, null, 2), "utf8");
    return init;
  }
}

function saveProfile(profile_text) {
  ensureFile();
  const payload = {
    profile_text: String(profile_text ?? ""),
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

module.exports = { getProfile, saveProfile };