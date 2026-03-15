"use strict";

function basicAuth(req, res, next) {
  const user = process.env.BASIC_USER || "";
  const pass = process.env.BASIC_PASS || "";

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Operator Panel"');
    return res.status(401).send("Authentication required");
  }

  const b64 = auth.slice("Basic ".length);
  const [u, p] = Buffer.from(b64, "base64").toString("utf8").split(":");

  if (u === user && p === pass) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Operator Panel"');
  return res.status(401).send("Invalid credentials");
}

module.exports = basicAuth;