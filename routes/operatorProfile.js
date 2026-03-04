"use strict";

const express = require("express");
const router = express.Router();
const { getProfile, saveProfile } = require("../services/operatorProfileService");

// GET /api/operator/profile
router.get("/profile", (req, res) => {
  const data = getProfile();
  res.json(data);
});

// POST /api/operator/profile
router.post("/profile", express.json(), (req, res) => {
  const { profile_text } = req.body || {};
  const saved = saveProfile(profile_text);
  res.json(saved);
});

module.exports = router;