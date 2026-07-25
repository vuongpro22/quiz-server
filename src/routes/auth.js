import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key_antigravity";
export const authRouter = express.Router();

function parseUserAgent(ua) {
  if (!ua) return "Unknown Device";
  let os = "Unknown OS";
  let browser = "Unknown Browser";
  
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("iPad")) os = "iPad";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";
  
  if (ua.includes("Firefox") && !ua.includes("Seamonkey")) browser = "Firefox";
  else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edge") || ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";
  
  return `${os} (${browser})`;
}

async function recordLoginHistory(user, req) {
  try {
    const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const clientIp = String(rawIp).split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || "";
    
    const isLocal =
      !clientIp ||
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp === "::ffff:127.0.0.1" ||
      clientIp.startsWith("192.168.") ||
      clientIp.startsWith("10.") ||
      clientIp.startsWith("172.16.") ||
      clientIp.startsWith("172.17.") ||
      clientIp.startsWith("172.18.") ||
      clientIp.startsWith("172.19.") ||
      clientIp.startsWith("172.20.") ||
      clientIp.startsWith("172.21.") ||
      clientIp.startsWith("172.22.") ||
      clientIp.startsWith("172.23.") ||
      clientIp.startsWith("172.24.") ||
      clientIp.startsWith("172.25.") ||
      clientIp.startsWith("172.26.") ||
      clientIp.startsWith("172.27.") ||
      clientIp.startsWith("172.28.") ||
      clientIp.startsWith("172.29.") ||
      clientIp.startsWith("172.30.") ||
      clientIp.startsWith("172.31.");

    let location = "Unknown Location";
    if (isLocal) {
      location = "Localhost (Hà Nội, VN)";
    } else {
      try {
        const res = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,regionName,city`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            location = `${data.city}, ${data.regionName}, ${data.country}`;
          }
        }
      } catch (e) {
        console.error("GeoIP lookup error:", e.message);
      }
    }

    if (!user.loginHistory) {
      user.loginHistory = [];
    }

    user.loginHistory.push({
      ip: clientIp || "0.0.0.0",
      device: parseUserAgent(userAgent),
      location,
      loginTime: new Date()
    });
    
    if (user.loginHistory.length > 50) {
      user.loginHistory.shift();
    }

    await user.save();
  } catch (err) {
    console.error("Failed to record login history:", err);
  }
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const { username, password, fullName } = req.body ?? {};
    if (!username || !password || !fullName) {
      res.status(400).json({ error: "Username, password and fullName are required" });
      return;
    }
    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      res.status(400).json({ error: "Username already exists" });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: cleanUsername,
      password: hashedPassword,
      fullName: String(fullName).trim(),
    });
    await user.save();
    await recordLoginHistory(user, req);
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      }
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    const cleanUsername = String(username).trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      res.status(400).json({ error: "Invalid username or password" });
      return;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: "Invalid username or password" });
      return;
    }
    await recordLoginHistory(user, req);
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    
    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      }
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (e) {
    next(e);
  }
});
