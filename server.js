// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage });

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Schema and Model
const submissionSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobile: String,
  message: String,
  resumePath: String,
  createdAt: { type: Date, default: Date.now },
});

const Submission = mongoose.model("Submission", submissionSchema);

// Route to receive form submissions
app.post("/api/submit", upload.single("resume"), async (req, res) => {
  try {
    const { name, email, mobile, message } = req.body;
    const resumePath = req.file ? req.file.path : "";

    const newSubmission = new Submission({
      name,
      email,
      mobile,
      message,
      resumePath,
    });

    await newSubmission.save();
    res.status(201).json({ message: "Submission saved successfully" });
  } catch (err) {
    console.error("Form submission error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
