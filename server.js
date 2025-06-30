require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "https://apply4me-frontend.vercel.app",
    "https://apply4me-frontend-9tjtasn0b-alunixs-projects.vercel.app",
    // Vercel also provides automatic domains, so let's include pattern matching
    /^https:\/\/apply4me-frontend.*\.vercel\.app$/,
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Add preflight handling
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Memory storage for files (since Render has ephemeral storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// MongoDB connection with enhanced logging
console.log(
  "Connecting to MongoDB with URI:",
  process.env.MONGO_URI?.substring(0, 25) + "..."
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("connected", () => console.log("Mongoose connected"));
mongoose.connection.on("error", (err) => console.error("Mongoose error:", err));
mongoose.connection.on("disconnected", () =>
  console.log("Mongoose disconnected")
);

// Schema and model
const submissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: String,
  message: String,
  resume: {
    data: Buffer,
    contentType: String,
    originalName: String,
  },
  createdAt: { type: Date, default: Date.now },
});

const Submission = mongoose.model("Submission", submissionSchema);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date(),
    cors: corsOptions.origin,
  });
});

// Add a test endpoint
app.get("/api/test", (req, res) => {
  console.log("Test endpoint hit from origin:", req.get("origin"));
  res.json({
    message: "Backend is working!",
    origin: req.get("origin"),
    headers: req.headers,
  });
});

// Form submission endpoint with enhanced error handling and logging
app.post("/api/submit", upload.single("resume"), async (req, res) => {
  try {
    console.log("=== NEW SUBMISSION ATTEMPT ===");
    console.log("Origin:", req.get("origin"));
    console.log("Content-Type:", req.get("content-type"));
    console.log("Request body fields:", Object.keys(req.body));
    console.log("Request body values:", req.body);
    console.log(
      "File info:",
      req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : "No file"
    );

    const { name, email, mobile, message } = req.body;

    // Enhanced validation with detailed logging
    if (!name || name.trim() === "") {
      console.log("Validation failed: Name is missing or empty");
      return res.status(400).json({
        error: "Validation failed",
        details: "Name is required and cannot be empty",
        field: "name",
      });
    }

    if (!email || email.trim() === "") {
      console.log("Validation failed: Email is missing or empty");
      return res.status(400).json({
        error: "Validation failed",
        details: "Email is required and cannot be empty",
        field: "email",
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Validation failed: Invalid email format");
      return res.status(400).json({
        error: "Validation failed",
        details: "Please enter a valid email address",
        field: "email",
      });
    }

    const submissionData = {
      name: name.trim(),
      email: email.trim(),
      mobile: mobile ? mobile.trim() : "",
      message: message ? message.trim() : "",
    };

    // Handle file if present
    if (req.file) {
      console.log("Processing uploaded file...");
      submissionData.resume = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    console.log("Attempting to save submission to database...");
    const newSubmission = new Submission(submissionData);
    const savedSubmission = await newSubmission.save();

    console.log(
      "✅ Submission saved successfully with ID:",
      savedSubmission._id
    );
    console.log("=== SUBMISSION SUCCESS ===");

    res.status(201).json({
      success: true,
      message: "Submission saved successfully",
      submissionId: savedSubmission._id,
    });
  } catch (err) {
    console.error("❌ SUBMISSION ERROR:", err);
    console.error("Error stack:", err.stack);
    console.log("=== SUBMISSION FAILED ===");

    // Check if it's a MongoDB error
    if (err.name === "ValidationError") {
      return res.status(400).json({
        error: "Database validation failed",
        details: err.message,
        fields: Object.keys(err.errors),
      });
    }

    if (err.name === "MongoError" || err.name === "MongoServerError") {
      return res.status(500).json({
        error: "Database error",
        details:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Database connection issue",
      });
    }

    res.status(500).json({
      error: "Server error",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.send(`
    <h1>Apply4Me Backend</h1>
    <p>Server is running ✅</p>
    <p><a href="/api/health">Check health</a></p>
    <p><a href="/api/test">Test endpoint</a></p>
    <p>Environment: ${process.env.NODE_ENV || "development"}</p>
    <p>CORS Origins: ${corsOptions.origin.join(", ")}</p>
  `);
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  console.error("Error stack:", err.stack);
  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
    🚀 Server running on port ${PORT}
    📍 Environment: ${process.env.NODE_ENV || "development"}
    🌐 CORS allowed origins: ${corsOptions.origin.join(", ")}
    📊 MongoDB: ${
      mongoose.connection.readyState === 1 ? "Connected" : "Connecting..."
    }
  `);
});
