require("dotenv").config(); // Load .env variables

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Debug print for your MONGO_URI
console.log("MONGO_URI from env:", process.env.MONGO_URI);

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable not set!");
  process.exit(1); // Stop server if no URI
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (optional)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Schema and model
const submissionSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobile: String,
  message: String,
  resumePath: String,
  createdAt: { type: Date, default: Date.now },
});

const Submission = mongoose.model("Submission", submissionSchema);

// API route for form submission
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

app.get("/", (req, res) => {
  res.send("Apply4me backedn server is runing !");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
